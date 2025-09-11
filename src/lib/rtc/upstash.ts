// "use server";
const URL = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
if (!URL || !TOKEN) console.warn("[upstash] Missing UPSTASH envs");

type Cmd = (string|number)[];
async function pipe(commands: Cmd[]): Promise<any[]>{
  const r = await fetch(`${URL}/pipeline`, {
    method:"POST", headers:{ "content-type":"application/json", authorization:`Bearer ${TOKEN}`},
    body: JSON.stringify({ commands }), cache:"no-store"
  });
  if(!r.ok){ throw new Error(`[upstash] ${r.status} ${await r.text()}`); }
  const json = await r.json(); return json.map((e:any)=>e.result);
}
export async function setNxPx(k:string,v:string,px:number){ const [res]=await pipe([["SET",k,v,"NX","PX",px]]); return res==="OK"; }
export async function setPx(k:string,v:string,px:number){ const [res]=await pipe([["SET",k,v,"PX",px]]); return res==="OK"; }
export async function set(k:string,v:string){ const [res]=await pipe([["SET",k,v]]); return res==="OK"; }
export async function get(k:string){ const [res]=await pipe([["GET",k]]); return res??null; }
export async function del(k:string){ await pipe([["DEL",k]]); }
export async function expire(k:string,s:number){ await pipe([["EXPIRE",k,s]]); }
export async function exists(k:string){ const [n]=await pipe([["EXISTS",k]]); return n===1; }
export async function hset(k:string,o:Record<string,string|number>){ const flat:(string|number)[]=[]; Object.entries(o).forEach(([k,v])=>flat.push(k,String(v))); await pipe([["HSET",k,...flat]]); }
export async function hgetall(k:string){ const [arr]=await pipe([["HGETALL",k]]); const out:Record<string,string>={}; if(Array.isArray(arr)){ for(let i=0;i<arr.length;i+=2) out[arr[i]]=arr[i+1]; } return out; }
export async function sadd(k:string,m:string){ await pipe([["SADD",k,m]]); }
export async function sismember(k:string,m:string){ const [n]=await pipe([["SISMEMBER",k,m]]); return n===1; }
export async function zadd(k:string,score:number,m:string){ await pipe([["ZADD",k,score,m]]); }
export async function zrem(k:string,m:string){ await pipe([["ZREM",k,m]]); }
export async function zcard(k:string){ const [n]=await pipe([["ZCARD",k]]); return Number(n||0); }
export async function zrange(k:string,s=0,e=49){ const [res]=await pipe([["ZRANGE",k,s,e]]); return Array.isArray(res)?res:[]; }
export async function zremrangebyscore(k:string,min:string,max:string){ await pipe([["ZREMRANGEBYSCORE",k,min,max]]); }
export async function lpush(k:string,v:string){ await pipe([["LPUSH",k,v]]); }
export async function lrange(k:string,start=0,stop=49){ const [res]=await pipe([["LRANGE",k,start,stop]]); return Array.isArray(res)?res:[]; }
export async function ltrim(k:string,start:number,stop:number){ await pipe([["LTRIM",k,start,stop]]); }
/* simple rate limit: limit per windowSec */
export async function rateLimit(key:string, limit:number, windowSec:number){
  const bucket=`rl:${key}:${Math.floor(Date.now()/(windowSec*1000))}`;
  const [count]=await pipe([["INCR",bucket],["EXPIRE",bucket,windowSec]]);
  return Number(count||0) <= limit;
}
