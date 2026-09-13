import { currentUserId } from '@/lib/auth';
import { db } from '@/lib/db';

// Who is currently visiting my room right now (polled by the host so a guest
// can show up on their screen too, not just the other way around).
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  try {
    const result = await db().query<{ username: string }>(
      "SELECT u.username FROM presence p JOIN users u ON u.id = p.user_id WHERE p.visiting = $1 AND p.last_seen > now() - interval '20 seconds'",
      [userId],
    );
    return Response.json({ success: true, data: result.rows.map(r => r.username) });
  } catch (e) {
    console.error(`[visitors] DB error for ${userId}:`, e);
    return Response.json({ success: false, error: 'Could not load visitors.' }, { status: 500 });
  }
}
