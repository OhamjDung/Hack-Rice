import { cookies } from 'next/headers';
import { loginInput } from '@/schemas/api';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const input = loginInput.safeParse(body);
  if (!input.success) { console.log(`[login] rejected: bad input for username "${body?.username}"`); return Response.json({ success: false, error: 'Enter your username and password.' }, { status: 400 }); }
  const { username, password } = input.data;
  try {
    const result = await db().query<{ id: string; username: string; password_hash: string }>('SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)', [username]);
    const user = result.rows[0];
    if (!user) { console.log(`[login] rejected: no account "${username}"`); return Response.json({ success: false, error: 'Incorrect username or password.' }, { status: 401 }); }
    if (!(await verifyPassword(password, user.password_hash))) { console.log(`[login] rejected: bad password for "${username}"`); return Response.json({ success: false, error: 'Incorrect username or password.' }, { status: 401 }); }
    (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 });
    console.log(`[login] ok ${user.id} (${user.username})`);
    return Response.json({ success: true, data: { username: user.username } });
  } catch (e) {
    console.error(`[login] DB error for "${username}":`, e);
    return Response.json({ success: false, error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
