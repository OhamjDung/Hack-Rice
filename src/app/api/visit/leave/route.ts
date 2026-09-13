import { currentUserId } from '@/lib/auth';
import { db } from '@/lib/db';

// Clears "I am visiting X" so the host's guest list stops showing this account.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  try {
    await db().query('UPDATE presence SET visiting = NULL WHERE user_id = $1', [userId]);
    return Response.json({ success: true, data: null });
  } catch (e) {
    console.error(`[visit:leave] DB error for ${userId}:`, e);
    return Response.json({ success: false, error: 'Could not update presence.' }, { status: 500 });
  }
}
