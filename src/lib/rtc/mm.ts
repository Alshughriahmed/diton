// Matchmaker logic for WebRTC
import { zadd, zrem, zrangebyscore, zremrangebyscore, hget, hset, expire } from "./upstash";

interface MatchCandidate {
  id: string;
  score: number;
  attrs?: Record<string, any>;
}

export async function touchQueue(anonId: string) {
  const now = Date.now();
  await zadd("rtc:q", now, anonId);
  return now;
}

export async function findMatch(anonId: string): Promise<{ pairId: string; role: "caller" | "callee"; peer?: string } | null> {
  const now = Date.now();
  const cutoff = now - 60000; // 60 seconds timeout
  
  // Get candidates from queue, excluding self
  const candidates = await zrangebyscore("rtc:q", cutoff.toString(), "+inf", 50);
  
  for (const cand of candidates) {
    if (cand === anonId) continue;
    
    // Check if candidate is still alive
    const alive = await hget(`rtc:attrs:${cand}`, "ts");
    if (!alive || parseInt(alive) < cutoff) {
      await zrem("rtc:q", cand);
      continue;
    }
    
    // Found a match, create pair
    const pairId = `pair-${now}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Remove both from queue
    await Promise.all([
      zrem("rtc:q", anonId),
      zrem("rtc:q", cand)
    ]);
    
    // Assign roles (first one becomes caller)
    const role = "caller";
    const peerRole = "callee";
    
    // Store pair mapping
    await Promise.all([
      hset(`rtc:who:${anonId}`, "pairId", pairId),
      hset(`rtc:who:${anonId}`, "role", role),
      hset(`rtc:who:${cand}`, "pairId", pairId),
      hset(`rtc:who:${cand}`, "role", peerRole),
      expire(`rtc:pair:${pairId}`, 150),
      expire(`rtc:who:${anonId}`, 150),
      expire(`rtc:who:${cand}`, 150)
    ]);
    
    return { pairId, role, peer: cand };
  }
  
  return null;
}

export async function cleanupExpired() {
  const cutoff = Date.now() - 60000;
  await zremrangebyscore("rtc:q", "-inf", `(${cutoff}`);
}