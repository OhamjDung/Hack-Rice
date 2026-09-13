import { currentUserId } from '@/lib/auth';
import { db } from '@/lib/db';

// Called by the visitor's own client while walking around a host's room, so the
// host's /api/visitors poll can render the visitor's marker at its live position.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const x = Number(body?.x), y = Number(body?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Response.json({ success: false, error: 'Invalid position.' }, { status: 400 });
  try {
    await db().query('UPDATE presence SET visit_x = $2, visit_y = $3 WHERE user_id = $1', [userId, x, y]);
    return Response.json({ success: true, data: null });
  } catch (e) {
    console.error(`[visit:position] DB error for ${userId}:`, e);
    return Response.json({ success: false, error: 'Could not update position.' }, { status: 500 });
  }
}
