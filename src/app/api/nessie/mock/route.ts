import { mockInput } from '@/schemas/api';
import type { BankTransaction } from '@/engine/Types';
import { dayOfMonth,monthOfRun } from '@/engine/DailyReview';
export async function POST(req:Request){
 const input=mockInput.safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({success:false,error:'Choose a category and enter a positive amount.'},{status:400});
 const {turn,index,category,amount}=input.data;
 const data:BankTransaction={id:`demo-${turn}-${index}`,payerId:'demo',medium:'balance',paymentDate:`Month ${monthOfRun(turn)} · Day ${dayOfMonth(turn)}`,gameDay:turn,amount,description:`${category==='savings'?'Savings transfer':'Room purchase'} · ${category}`,category,kind:category==='savings'?'saving':'purchase'};
 return Response.json({success:true,data,source:'demo'});
}
