import {
  setNxPx,setPx,get,del,expire,exists,hset,hgetall,sadd,sismember,
  zadd,zrem,zcard,zrange,zremrangebyscore,lpush,lrange,ltrim,rateLimit
} from "./upstash";
import { ulid, pairLockKey } from "./ids";

export type Attrs={ gender:string; country:string; };
export type Filters={ genders?:string; countries?:string; };

export function intersectOk(f:Filters,a:Attrs){
  const gs=(f.genders||"all").toLowerCase(); const cs=(f.countries||"ALL").toUpperCase();
  const gOk= gs==="all" || gs.split(",").includes(a.gender.toLowerCase());
  const cOk= cs==="ALL" || cs.split(",").includes(a.country.toUpperCase());
  return gOk && cOk;
}
export async function enqueue(anonId:string, attr:Attrs, filt:Filters){
  await Promise.all([
    hset(`rtc:attrs:${anonId}`,{gender:attr.gender,country:attr.country}), expire(`rtc:attrs:${anonId}`,120),
    hset(`rtc:filters:${anonId}`,{genders:(filt.genders||"all"),countries:(filt.countries||"ALL")}), expire(`rtc:filters:${anonId}`,120),
    zadd(`rtc:q`,Date.now(),anonId),
    zadd(`rtc:q:gender:${attr.gender.toLowerCase()}`,Date.now(),anonId),
    zadd(`rtc:q:country:${attr.country.toUpperCase()}`,Date.now(),anonId),
  ]);
}
export async function touchQueue(anonId:string, attr:Attrs){
  await Promise.all([
    zadd(`rtc:q`,Date.now(),anonId),
    zadd(`rtc:q:gender:${attr.gender.toLowerCase()}`,Date.now(),anonId),
    zadd(`rtc:q:country:${attr.country.toUpperCase()}`,Date.now(),anonId),
  ]);
}
export async function cleanStaleQueue(){ const cutoff=Date.now()-60_000; await zremrangebyscore(`rtc:q`,"-inf",`(${cutoff}`); }

async function candidatePool(selfAttr:Attrs, selfFilt:Filters){
  const wantedC=(selfFilt.countries||"ALL").toUpperCase(); const wantedG=(selfFilt.genders||"all").toLowerCase();
  
    const sets:string[][] = [];
    const add = async (key:string, a=0, b=49) => { try { sets.push(await zrange(key, a, b)); } catch {} };

    // VIP first (country → gender → global)
    if (wantedC !== "ALL") {
      for (const cc of wantedC.split(",").slice(0,15)) {
        await add(`rtc:q:vip:country:${cc}`, 0, 19);
        await add(`rtc:q:country:${cc}`,      0, 19);
      }
    }
    if (wantedG !== "all") {
      for (const g of wantedG.split(",").slice(0,2)) {
        await add(`rtc:q:vip:gender:${g}`, 0, 19);
        await add(`rtc:q:gender:${g}`,     0, 19);
      }
    }
    await add(`rtc:q:vip`, 0, 49);
    await add(`rtc:q`,     0, 49);
  
  const seen=new Set<string>(); const out:string[]=[];
  for(const arr of sets){ for(const id of arr){ if(!seen.has(id)){ seen.add(id); out.push(id); } } }
  return out;
}

export async function matchmake(self:string){

  const rlOk=await rateLimit(`mm:${self}`,8,5); if(!rlOk) return {status:429 as const, body:{error:"rate"}};
  const selfLock=await setNxPx(`rtc:matching:${self}`,"1",5000); if(!selfLock) return {status:204 as const};
  try{
      const [selfAttrRaw,selfFiltRaw]=await Promise.all([hgetall(`rtc:attrs:${self}`),hgetall(`rtc:filters:${self}`)]);
      if(!selfAttrRaw?.gender||!selfAttrRaw?.country){ return {status:400 as const, body:{error:"missing-attrs"}}; }
      const selfAttr: Attrs = {gender: selfAttrRaw.gender, country: selfAttrRaw.country};
      const selfFilt: Filters = {genders: selfFiltRaw?.genders, countries: selfFiltRaw?.countries};

      // === prev wish single-sided & dual-sided ===

      try{
        const selfBase = self.split(".")[0];
        const wish = await get(`rtc:prev-wish:${self}`) || await get(`rtc:prev-wish:${selfBase}`);
        if(wish && wish !== self){
          const cand = String(wish);
          const alive = await exists(`rtc:attrs:${cand}`);
          const mapped = await get(`rtc:pair:map:${cand}`);
          if(alive && !mapped){
            // اختياريًا احترم التقاطعات
            const [candAttrRaw,candFiltRaw]=await Promise.all([hgetall(`rtc:attrs:${cand}`),hgetall(`rtc:filters:${cand}`)]);
            const candAttr: Attrs = {gender: candAttrRaw?.gender || "", country: candAttrRaw?.country || ""};
            const candFilt: Filters = {genders: candFiltRaw?.genders, countries: candFiltRaw?.countries};
            const okA=intersectOk(selfFilt,candAttr); const okB=intersectOk(candFilt,selfAttr);
            if(okA && okB){
              if(await setNxPx(`rtc:claim:${cand}`,self,6000)){
                const pairLock=pairLockKey(self,cand);
                if(await setNxPx(pairLock,"1",6000)){
                  const pairId=ulid();
                  await Promise.all([
                    hset(`rtc:pair:${pairId}`,{a:self,b:cand,role_a:"caller",role_b:"callee",created:Date.now()}),
                    expire(`rtc:pair:${pairId}`,150),
                    setPx(`rtc:pair:map:${self}`,`${pairId}|caller`,150_000),
                    setPx(`rtc:pair:map:${cand}`,`${pairId}|callee`,150_000),
                    zrem(`rtc:q`,self), zrem(`rtc:q`,cand),
                    zrem(`rtc:q:gender:${selfAttr.gender.toLowerCase()}`,self),
                    zrem(`rtc:q:gender:${candAttr.gender?.toLowerCase?.()||""}`,cand),
                    zrem(`rtc:q:country:${selfAttr.country.toUpperCase()}`,self),
                    zrem(`rtc:q:country:${candAttr.country?.toUpperCase?.()||""}`,cand),
                    sadd(`rtc:seen:${self}`,cand), expire(`rtc:seen:${self}`,300),
                    sadd(`rtc:seen:${cand}`,self), expire(`rtc:seen:${cand}`,300),
                    del(`rtc:claim:${cand}`), del(pairLock),
                  ]);
                  await del(`rtc:prev-wish:${self}`);
                  // Write rtc:last for both ID formats for compatibility
      const selfBase = self.split(".")[0];
      const candBase = cand.split(".")[0];
      await Promise.all([ 
        setPx(`rtc:last:${self}`, cand, 90_000), setPx(`rtc:last:${selfBase}`, candBase, 90_000),
        setPx(`rtc:last:${cand}`, self, 90_000), setPx(`rtc:last:${candBase}`, selfBase, 90_000)
      ]);
                  return {status:200 as const, body:{pairId, role:"caller" as const, peerAnonId:cand}};
                } else { await del(`rtc:claim:${cand}`); }
              }
            }
          }
        }
      }catch{}
      // === /prev wish ===
      // === prev for: another user asked to reconnect with me ===
      try{
        const selfBase = self.split(".")[0];
        const caller = await get(`rtc:prev-for:${self}`) || await get(`rtc:prev-for:${selfBase}`);
        if(caller && caller !== self){
          const cand = String(caller);
          const alive = await exists(`rtc:attrs:${cand}`);
          const mapped = await get(`rtc:pair:map:${cand}`);
          if(alive && !mapped){
            const [candAttrRaw,candFiltRaw]=await Promise.all([hgetall(`rtc:attrs:${cand}`),hgetall(`rtc:filters:${cand}`)]);
            const candAttr: Attrs = {gender: candAttrRaw?.gender || "", country: candAttrRaw?.country || ""};
            const candFilt: Filters = {genders: candFiltRaw?.genders, countries: candFiltRaw?.countries};
            const okA=intersectOk(selfFilt,candAttr); const okB=intersectOk(candFilt,selfAttr);
            if(okA && okB){
              if(await setNxPx(`rtc:claim:${cand}`,self,6000)){
                const pairLock=pairLockKey(self,cand);
                if(await setNxPx(pairLock,"1",6000)){
                  const pairId=ulid();
                  await Promise.all([
                    hset(`rtc:pair:${pairId}`,{a:cand,b:self,role_a:"caller",role_b:"callee",created:Date.now()}),
                    expire(`rtc:pair:${pairId}`,150),
                    setPx(`rtc:pair:map:${cand}`,`${pairId}|caller`,150_000),
                    setPx(`rtc:pair:map:${self}`,`${pairId}|callee`,150_000),
                    zrem(`rtc:q`,self), zrem(`rtc:q`,cand),
                    zrem(`rtc:q:gender:${selfAttr.gender.toLowerCase()}`,self),
                    zrem(`rtc:q:gender:${candAttr.gender?.toLowerCase?.()||""}`,cand),
                    zrem(`rtc:q:country:${selfAttr.country.toUpperCase()}`,self),
                    zrem(`rtc:q:country:${candAttr.country?.toUpperCase?.()||""}`,cand),
                    sadd(`rtc:seen:${self}`,cand), expire(`rtc:seen:${self}`,300),
                    sadd(`rtc:seen:${cand}`,self), expire(`rtc:seen:${cand}`,300),
                    del(`rtc:claim:${cand}`), del(pairLock),
                  ]);
                  await del(`rtc:prev-for:${self}`);
                  // Write rtc:last for both ID formats for compatibility
      const selfBase = self.split(".")[0];
      const candBase = cand.split(".")[0];
      await Promise.all([ 
        setPx(`rtc:last:${self}`, cand, 90_000), setPx(`rtc:last:${selfBase}`, candBase, 90_000),
        setPx(`rtc:last:${cand}`, self, 90_000), setPx(`rtc:last:${candBase}`, selfBase, 90_000)
      ]);
                  return {status:200 as const, body:{pairId, role:"callee" as const, peerAnonId:cand}};
                } else { await del(`rtc:claim:${cand}`); }
              }
            }
          }
        }
      }catch{}
      // === /prev for ===

      const pool=await candidatePool(selfAttr,selfFilt);
    for(const cand of pool){
      if(cand===self) continue;
      if(await sismember(`rtc:seen:${self}`,cand)) continue;

      const alive=await exists(`rtc:attrs:${cand}`);
      if(!alive){ await zrem(`rtc:q`,cand); continue; }

      if(!(await setNxPx(`rtc:claim:${cand}`,self,6000))) continue;
      const pairLock=pairLockKey(self,cand);
      if(!(await setNxPx(pairLock,"1",6000))){ await del(`rtc:claim:${cand}`); continue; }

      const [candMap,candAttrRaw,candFiltRaw]=await Promise.all([get(`rtc:pair:map:${cand}`),hgetall(`rtc:attrs:${cand}`),hgetall(`rtc:filters:${cand}`)]);
      if(candMap){ await del(`rtc:claim:${cand}`); await del(pairLock); continue; }

      const candAttr: Attrs = {gender: candAttrRaw.gender || "", country: candAttrRaw.country || ""};
      const candFilt: Filters = {genders: candFiltRaw?.genders, countries: candFiltRaw?.countries};
      const okA=intersectOk(selfFilt,candAttr); const okB=intersectOk(candFilt,selfAttr);
      if(!okA||!okB){ await del(`rtc:claim:${cand}`); await del(pairLock); continue; }

      const pairId=ulid();
      await Promise.all([
        hset(`rtc:pair:${pairId}`,{a:self,b:cand,role_a:"caller",role_b:"callee",created:Date.now()}),
        expire(`rtc:pair:${pairId}`,150),
        setPx(`rtc:pair:map:${self}`,`${pairId}|caller`,150_000),
        setPx(`rtc:pair:map:${cand}`,`${pairId}|callee`,150_000),
        zrem(`rtc:q`,self), zrem(`rtc:q`,cand),
        zrem(`rtc:q:gender:${selfAttr.gender.toLowerCase()}`,self),
        zrem(`rtc:q:gender:${candAttr.gender?.toLowerCase?.()||""}`,cand),
        zrem(`rtc:q:country:${selfAttr.country.toUpperCase()}`,self),
        zrem(`rtc:q:country:${candAttr.country?.toUpperCase?.()||""}`,cand),
        sadd(`rtc:seen:${self}`,cand), expire(`rtc:seen:${self}`,300),
        sadd(`rtc:seen:${cand}`,self), expire(`rtc:seen:${cand}`,300),
        del(`rtc:claim:${cand}`), del(pairLock),
      ]);
      // Write rtc:last for both ID formats for compatibility
      const selfBase = self.split(".")[0];
      const candBase = cand.split(".")[0];
      await Promise.all([ 
        setPx(`rtc:last:${self}`, cand, 90_000), setPx(`rtc:last:${selfBase}`, candBase, 90_000),
        setPx(`rtc:last:${cand}`, self, 90_000), setPx(`rtc:last:${candBase}`, selfBase, 90_000)
      ]);
      return {status:200 as const, body:{pairId, role:"caller" as const, peerAnonId:cand}};
    }
    return {status:204 as const};
  }catch(e:any){
    return {status:500 as const, body:{error:"mm-fail", info:String(e?.message||e).slice(0,140)}};
  }finally{ await del(`rtc:matching:${self}`); }
}

export async function pairMapOf(anonId:string){ const map=await get(`rtc:pair:map:${anonId}`); if(!map) return null; const [pairId,role]=String(map).split("|"); return {pairId, role}; }
