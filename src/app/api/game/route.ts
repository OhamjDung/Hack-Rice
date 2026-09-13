import { currentUserId } from '@/lib/auth';
import { gameSaveInput } from '@/schemas/api';
import { db } from '@/lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  const result = await db().query<{ state: unknown }>('SELECT state FROM game_states WHERE user_id = $1', [userId]);
  if (!result.rowCount) return Response.json({ success: false, error: 'No saved game for this account.' }, { status: 404 });
  return Response.json({ success: true, data: result.rows[0].state });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  const input = gameSaveInput.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ success: false, error: 'Invalid game state.' }, { status: 400 });
  await db().query('UPDATE game_states SET state = $2, updated_at = now() WHERE user_id = $1', [userId, JSON.stringify(input.data.state)]);
  return Response.json({ success: true, data: null });
}
