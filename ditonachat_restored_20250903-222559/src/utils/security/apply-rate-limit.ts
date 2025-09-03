// Rate limiting wrapper for API routes

import { NextRequest } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, rateLimitConfigs } from './rate-limit';

type RateLimitType = keyof typeof rateLimitConfigs;

export function withRateLimit(handler: Function, limitType: RateLimitType = 'general') {
  return async function(request: NextRequest, ...args: any[]) {
    // Skip rate limiting in development or when disabled
    if (process.env.NODE_ENV === 'development' || process.env.RATE_LIMIT_ENABLED !== 'true') {
      return handler(request, ...args);
    }

    const config = rateLimitConfigs[limitType];
    const identifier = getClientIdentifier(request);
    const { allowed, remaining, resetTime } = checkRateLimit(identifier, config);

    if (!allowed) {
      return rateLimitResponse(config, resetTime);
    }

    // Add rate limit headers to successful responses
    const response = await handler(request, ...args);
    
    if (response instanceof Response) {
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
    }

    return response;
  };
}

// Usage examples (commented for reference):
/*
// In API route:
import { withRateLimit } from '@/utils/security/apply-rate-limit';

async function handler(request: NextRequest) {
  // Your API logic here
  return Response.json({ success: true });
}

export const GET = withRateLimit(handler, 'auth');
export const POST = withRateLimit(handler, 'stripe');
*/