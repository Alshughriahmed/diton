let lastHash = ''; 
let lastTs = 0;

export function shouldEmitNext(hash: string, minMs = 600) {
  const now = Date.now();
  if (hash === lastHash && now - lastTs < minMs) return false;
  lastHash = hash; 
  lastTs = now; 
  return true;
}