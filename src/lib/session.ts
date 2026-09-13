import { createHmac, timingSafeEqual } from 'node:crypto';
export const SESSION_COOKIE = 'cb_session';
function secret(): string { const s = process.env.SESSION_SECRET; if (!s) throw new Error('SESSION_SECRET is not set'); return s; }
function sign(userId: string): string { return createHmac('sha256', secret()).update(userId).digest('hex'); }
export function createSessionToken(userId: string): string { return `${userId}.${sign(userId)}`; }
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const userId = token.slice(0, i), sig = token.slice(i + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
