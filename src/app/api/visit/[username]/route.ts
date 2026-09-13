import { currentUserId } from '@/lib/auth';
import { usernameSchema } from '@/schemas/api';
import { db } from '@/lib/db';

// Read-only peek into another account's current room: used by the "visit a friend"
// swipe gesture. Requires the target to be online (heartbeated in the last 20s) —
// otherwise there is nothing live to show.
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ success: false, error: 'Not logged in.' }, { status: 401 });
  const parsed = usernameSchema.safeParse((await params).username);
  if (!parsed.success) return Response.json({ success: false, error: 'Invalid username.' }, { status: 400 });

  const user = await db().query<{ id: string; username: string }>('SELECT id, username FROM users WHERE lower(username) = lower($1)', [parsed.data]);
  const target = user.rows[0];
  if (!target) return Response.json({ success: false, error: 'No account with that username.' }, { status: 404 });
  if (target.id === userId) return Response.json({ success: false, error: "You can't visit yourself." }, { status: 400 });

  const presence = await db().query<{ online: boolean }>("SELECT last_seen > now() - interval '20 seconds' AS online FROM presence WHERE user_id = $1", [target.id]);
  if (!presence.rows[0]?.online) return Response.json({ success: false, error: `${parsed.data} isn't online right now.` }, { status: 409 });

  const state = await db().query<{ state: unknown }>('SELECT state FROM game_states WHERE user_id = $1', [target.id]);
  if (!state.rowCount) return Response.json({ success: false, error: 'That account has no room yet.' }, { status: 404 });
  return Response.json({ success: true, data: { username: target.username, state: state.rows[0].state } });
}
