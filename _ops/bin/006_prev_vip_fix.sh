set -Eeuo pipefail
TS="$(date -u +%Y%m%d-%H%M%S)"; BKP="_ops/backups/prev_vip_fix_${TS}"; mkdir -p "$BKP"
cp -a src/lib/rtc/mm.ts "$BKP/mm.ts" 2>/dev/null || true
cp -a src/app/api/match/next/route.ts "$BKP/match_next_route.ts" 2>/dev/null || true

# A) إدراج كتلة prev-for إن لم تكن موجودة
if ! grep -q "rtc:prev-for" src/lib/rtc/mm.ts; then
  cat > _ops/tmp.prev_for.ts << 'BLOCK'
      // === prev for: another user asked to reconnect with me ===
      try{
        const caller = await get(`rtc:prev-for:${self}`);
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
                  await Promise.all([ setPx(`rtc:last:${self}`, cand, 90_000), setPx(`rtc:last:${cand}`, self, 90_000) ]);
                  return {status:200 as const, body:{pairId, role:"callee" as const, peerAnonId:cand}};
                } else { await del(`rtc:claim:${cand}`); }
              }
            }
          }
        }
      }catch{}
      // === /prev for ===
BLOCK
  sed -i '/\/\/ === \/prev wish ===/r _ops/tmp.prev_for.ts' src/lib/rtc/mm.ts
  rm -f _ops/tmp.prev_for.ts
fi

# تقرير سريع
echo "MM_CONSUMES_PREV_FOR=$([ -n "$(grep -n "prev-for" src/lib/rtc/mm.ts || true)" ] && echo 1 || echo 0)"
echo "MM_SETS_LAST_KEYS=$([ -n "$(grep -n "rtc:last:" src/lib/rtc/mm.ts || true)" ] && echo 1 || echo 0)"
