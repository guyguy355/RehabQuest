import type { RequestHandler } from 'express';

type Options = { windowMs: number; max: number; key?: (ip: string, body: unknown) => string };

/**
 * Small in-memory fixed-window rate limiter for unauthenticated endpoints
 * (login, registration, password reset). Per process only; a multi-instance
 * deployment would need a shared store such as Redis.
 */
export function rateLimit({ windowMs, max, key }: Options): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (request, response, next) => {
    const now = Date.now();
    const ip = request.ip ?? 'unknown';
    const bucketKey = key ? key(ip, request.body) : ip;
    const bucket = hits.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(bucketKey, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;

      if (bucket.count > max) {
        response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
        response.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' });
        return;
      }
    }

    if (hits.size > 10_000) {
      for (const [entryKey, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(entryKey);
      }
    }

    next();
  };
}
