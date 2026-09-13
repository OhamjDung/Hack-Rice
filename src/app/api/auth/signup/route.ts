import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { signupInput } from '@/schemas/api';
import { hashPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const input = signupInput.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ success: false, error: 'Enter a username (3-24 letters/numbers/underscore) and a password of at least 6 characters.' }, { status: 400 });
  const { username, password, initialState } = input.data;
  const existing = await db().query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rowCount) return Response.json({ success: false, error: 'That username is already taken.' }, { status: 409 });
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await db().query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [id, username, passwordHash]);
  await db().query('INSERT INTO game_states (user_id, state) VALUES ($1, $2)', [id, JSON.stringify(initialState)]);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 });
  return Response.json({ success: true, data: { username } });
}
