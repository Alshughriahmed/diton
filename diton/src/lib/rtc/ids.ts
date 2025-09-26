export function ulid(){ if("randomUUID" in crypto) return (crypto as any).randomUUID(); return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }
export function pairLockKey(a:string,b:string){ const [x,y]=[a,b].sort(); return `rtc:pairlock:${x}:${y}`; }
