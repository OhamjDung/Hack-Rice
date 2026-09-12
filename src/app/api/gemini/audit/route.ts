import { auditInput } from '@/schemas/api';
import { auditInitialBudget } from '@/lib/geminiClient';
export async function POST(req: Request) { const input = auditInput.safeParse(await req.json().catch(() => null)); if (!input.success)
    return Response.json({ success: false, error: 'Please provide a valid income and six budget allocations.' }, { status: 400 }); return Response.json({ success: true, ...await auditInitialBudget(input.data) }); }
