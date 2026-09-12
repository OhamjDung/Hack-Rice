import { syncNessie } from '@/lib/nessieClient';
export async function GET(req:Request) { try {
    const value=new URL(req.url).searchParams.get('day');
    const day=value===null?undefined:Number(value);
    if(day!==undefined&&(!Number.isInteger(day)||day<1||day>30))return Response.json({success:false,error:'Choose a day from 1 to 30.'},{status:400});
    return Response.json({ success: true, data: await syncNessie(day), source: 'nessie' });
}
catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Bank sync failed.' }, { status: 502 });
} }
