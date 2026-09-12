import { syncNessie } from '@/lib/nessieClient';
export async function GET() { try {
    return Response.json({ success: true, data: await syncNessie(), source: 'nessie' });
}
catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Bank sync failed.' }, { status: 502 });
} }
