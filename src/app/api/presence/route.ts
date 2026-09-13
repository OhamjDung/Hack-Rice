import { currentUserId } from '@/lib/auth';
import { db } from '@/lib/db';

// Heartbeat: call every few seconds while a tab is open and logged in, so other
// users' visit checks can tell whether this account is actually online right now.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  await db().query('INSERT INTO presence (user_id, last_seen) VALUES ($1, now()) ON CONFLICT (user_id) DO UPDATE SET last_seen = now()', [userId]);
  return Response.json({ success: true, data: null });
}
