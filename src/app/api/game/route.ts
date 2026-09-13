import { currentUserId } from '@/lib/auth';
import { gameSaveInput } from '@/schemas/api';
import { db } from '@/lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) { console.log('[game:get] rejected: no session'); return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 }); }
  try {
    const result = await db().query<{ state: unknown }>('SELECT state FROM game_states WHERE user_id = $1', [userId]);
    if (!result.rowCount) { console.log(`[game:get] ${userId}: no saved game`); return Response.json({ success: false, error: 'No saved game for this account.' }, { status: 404 }); }
    return Response.json({ success: true, data: result.rows[0].state });
  } catch (e) {
    console.error(`[game:get] DB error for ${userId}:`, e);
    return Response.json({ success: false, error: 'Could not load your game.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) { console.log('[game:save] rejected: no session'); return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 }); }
  const input = gameSaveInput.safeParse(await req.json().catch(() => null));
  if (!input.success) { console.log(`[game:save] rejected: invalid state for ${userId}`, input.error.issues); return Response.json({ success: false, error: 'Invalid game state.' }, { status: 400 }); }
  try {
    await db().query('UPDATE game_states SET state = $2, updated_at = now() WHERE user_id = $1', [userId, JSON.stringify(input.data.state)]);
    return Response.json({ success: true, data: null });
  } catch (e) {
    console.error(`[game:save] DB error for ${userId}:`, e);
    return Response.json({ success: false, error: 'Could not save your game.' }, { status: 500 });
  }
}
