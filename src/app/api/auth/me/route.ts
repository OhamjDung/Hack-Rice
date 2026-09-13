import { currentUserId } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: true, data: null });
  const result = await db().query<{ username: string }>('SELECT username FROM users WHERE id = $1', [userId]);
  return Response.json({ success: true, data: result.rows[0] ? { username: result.rows[0].username } : null });
}
