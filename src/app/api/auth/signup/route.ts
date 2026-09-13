import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { signupInput } from '@/schemas/api';
import { hashPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const input = signupInput.safeParse(body);
  if (!input.success) { console.log(`[signup] rejected: bad input for username "${body?.username}"`, input.error.issues); return Response.json({ success: false, error: 'Enter a username (3-24 letters/numbers/underscore) and a password of at least 6 characters.' }, { status: 400 }); }
  const { username, password, initialState } = input.data;
  try {
    const existing = await db().query('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
    if (existing.rowCount) { console.log(`[signup] rejected: "${username}" already taken`); return Response.json({ success: false, error: 'That username is already taken.' }, { status: 409 }); }
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await db().query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [id, username, passwordHash]);
    await db().query('INSERT INTO game_states (user_id, state) VALUES ($1, $2)', [id, JSON.stringify(initialState)]);
    (await cookies()).set(SESSION_COOKIE, createSessionToken(id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 });
    console.log(`[signup] created ${id} (${username})`);
    return Response.json({ success: true, data: { username } });
  } catch (e) {
    console.error(`[signup] DB error for "${username}":`, e);
    return Response.json({ success: false, error: 'Signup failed. Please try again.' }, { status: 500 });
  }
}
