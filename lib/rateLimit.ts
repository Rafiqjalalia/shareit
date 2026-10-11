import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Basic in-memory sliding window rate limiter for serverless environments.
 * Prevents API abuse and inflated stats tracking.
 */
export function checkRateLimit(
  req: NextRequest,
  limit = 60,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number } {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'anonymous';

  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Periodic cleanup of stale records
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count };
}

/**
 * Validates tracking events.
 */
export function isValidTrackEvent(event: unknown): event is 'open' | 'download' {
  return event === 'open' || event === 'download';
}

/**
 * Validates file ID string.
 */
export function isValidFileId(fileId: unknown): fileId is string {
  return typeof fileId === 'string' && fileId.trim().length > 0 && fileId.length < 4096;
}
