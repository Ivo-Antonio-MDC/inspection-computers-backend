import type { Request } from 'express';

export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first?.trim() || req.ip || null)?.slice(0, 64) ?? null;
}
