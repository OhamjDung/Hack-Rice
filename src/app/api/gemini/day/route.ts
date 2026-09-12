export const maxDuration = 50;
import { dailyInput } from '@/schemas/api';
import { analyzeDay } from '@/lib/geminiClient';
export async function POST(req:Request){
 const input=dailyInput.safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({success:false,error:'A valid game state and review kind are required.'},{status:400});
 const data=await analyzeDay(input.data.state,input.data.kind);
 return Response.json({success:true,data,source:data.source});
}
