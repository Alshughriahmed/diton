// Simple in-memory token bucket rate limiter
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per minute
}

const buckets = new Map<string, TokenBucket>();

export function checkRateLimit(
  identifier: string, 
  maxTokens: number = 30, 
  refillRate: number = 30
): boolean {
  const now = Date.now();
  const key = identifier;
  
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      tokens: maxTokens,
      lastRefill: now,
      maxTokens,
      refillRate
    };
    buckets.set(key, bucket);
  }
  
  // Refill tokens based on time passed
  const timePassed = (now - bucket.lastRefill) / (60 * 1000); // minutes
  const tokensToAdd = Math.floor(timePassed * bucket.refillRate);
  
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
  
  // Check if we have tokens available
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true; // Allow request
  }
  
  return false; // Rate limited
}

export function getRateLimitKey(req: Request, route: string): string {
  // Extract IP from request headers (works with Vercel/proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
  return `${ip}:${route}`;
}