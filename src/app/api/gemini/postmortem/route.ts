import { adviceInput } from '@/schemas/api';
import { analyzeGame } from '@/lib/geminiClient';
export async function POST(req: Request) { const input = adviceInput.safeParse(await req.json().catch(() => null)); if (!input.success)
    return Response.json({ success: false, error: 'Invalid game state.' }, { status: 400 }); return Response.json({ success: true, ...await analyzeGame(input.data.state, input.data.kind) }); }
