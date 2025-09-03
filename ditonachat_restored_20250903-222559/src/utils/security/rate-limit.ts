// Rate limiting utilities (stubbed for future implementation)

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === 'true';

// In-memory store for development (replace with Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;    // Error message
}

export const rateLimitConfigs = {
  auth: { windowMs: 60 * 1000, maxRequests: 10, message: 'Too many auth attempts' },
  stripe: { windowMs: 60 * 1000, maxRequests: 20, message: 'Too many payment requests' },
  turn: { windowMs: 60 * 1000, maxRequests: 30, message: 'Too many TURN requests' },
  general: { windowMs: 60 * 1000, maxRequests: 100, message: 'Too many requests' }
};

export function checkRateLimit(
  identifier: string, 
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  
  if (!RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: config.maxRequests, resetTime: Date.now() + config.windowMs };
  }

  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / config.windowMs)}`;
  
  let entry = requestCounts.get(key);
  
  if (!entry || entry.resetTime <= now) {
    entry = { count: 1, resetTime: now + config.windowMs };
    requestCounts.set(key, entry);
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: entry.resetTime };
  }
  
  entry.count++;
  requestCounts.set(key, entry);
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return { allowed, remaining, resetTime: entry.resetTime };
}

export function getClientIdentifier(request: Request): string {
  // Get client IP or fallback to user agent hash
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip || 'fallback';
}

export function rateLimitResponse(config: RateLimitConfig, resetTime: number) {
  return new Response(
    JSON.stringify({ 
      error: config.message || 'Rate limit exceeded', 
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000) 
    }),
    { 
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Window': (config.windowMs / 1000).toString()
      }
    }
  );
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (entry.resetTime <= now) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes