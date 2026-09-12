import { z } from 'zod';
import type { BankTransaction, CategoryKey } from '../engine/Types.ts';
export const accountSchema = z.object({ _id: z.string(), nickname: z.string().optional(), balance: z.number().finite(), type: z.string(), customer_id: z.string().optional() });
const purchaseSchema = z.object({ _id: z.string(), payer_id: z.string(), merchant_id: z.string().optional(), medium: z.enum(['balance', 'rewards']).default('balance'), purchase_date: z.string(), amount: z.number().nonnegative(), description: z.string().default('Purchase'), status: z.string() });
// Current accounts return `id` and omit parties; older accounts return `_id` and party IDs.
const transferSchema = z.object({ _id: z.string().optional(), id: z.string().optional(), payer_id: z.string().optional(), payee_id: z.string().optional(), transaction_date: z.string(), amount: z.number().nonnegative(), description: z.string().default('Transfer'), status: z.string() }).refine(t=>!!(t._id||t.id),'Transfer identifier is required');
async function get<T extends z.ZodType>(path: string, schema: T, emptyOn404=false): Promise<z.infer<T>> {
 const key=process.env.NESSIE_API_KEY;
 if(!key)throw new Error('Transaction updates are not configured yet.');
 const url=new URL(path,process.env.NESSIE_BASE_URL||'https://api.nessieisreal.com');
 if(url.hostname==='api.nessieisreal.com')url.protocol='https:';
 url.searchParams.set('key',key);
 let res:Response;
 try{res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});}
 catch{throw new Error('Could not reach transaction updates. Please try again.');}
 if(res.status===404&&emptyOn404)return schema.parse([]);
 if(!res.ok)throw new Error(`Transaction service returned ${res.status}. Please check the connection settings.`);
 try{return schema.parse(await res.json());}
 catch{throw new Error('The transaction service returned an unreadable update. Please try again.');}
}
export const fetchCustomerAccounts = (id: string) => get(`/customers/${encodeURIComponent(id)}/accounts`, z.array(accountSchema));
export const fetchAccountPurchases = (id: string) => get(`/accounts/${encodeURIComponent(id)}/purchases`, z.array(purchaseSchema),true);
export function categorizeMerchant(merchant: string, description: string): CategoryKey { const t = `${merchant} ${description}`.toLowerCase(); if (/rent|landlord|realty|mortgage/.test(t))
    return 'housing'; if (/electric|power|water|internet|verizon|wifi/.test(t))
    return 'utilities'; if (/uber|lyft|gas|shell|chevron|subway|transit|parking/.test(t))
    return 'transit'; if (/grocery|groceries|market|restaurant|cafe|burger|food/.test(t))
    return 'food'; return 'leisure'; }
const depositSchema=z.object({_id:z.string(),payee_id:z.string().optional(),medium:z.enum(['balance','rewards']).default('balance'),transaction_date:z.string(),amount:z.number().nonnegative(),description:z.string().default('Deposit'),status:z.string()});
const withdrawalSchema=z.object({_id:z.string(),payer_id:z.string().optional(),medium:z.enum(['balance','rewards']).default('balance'),transaction_date:z.string(),amount:z.number().nonnegative(),description:z.string().default('Withdrawal'),status:z.string()});
const settled=(status:string)=>['completed','executed'].includes(status.toLowerCase());
export function normalizeTransactions(checkingId:string,accounts:z.infer<typeof accountSchema>[],purchases:z.infer<typeof purchaseSchema>[],transfers:z.infer<typeof transferSchema>[],deposits:z.infer<typeof depositSchema>[],withdrawals:z.infer<typeof withdrawalSchema>[]){
 const transactions:BankTransaction[]=purchases.filter(p=>settled(p.status)&&p.payer_id===checkingId&&p.medium==='balance').map(p=>({id:`purchase-${p._id}`,payerId:p.payer_id,medium:p.medium,paymentDate:p.purchase_date,amount:p.amount,description:p.description,category:categorizeMerchant('',p.description),kind:'purchase'}));
 for(const t of transfers.filter(t=>settled(t.status))){
  if(t.payer_id&&t.payee_id&&(t.payer_id===t.payee_id||(t.payer_id!==checkingId&&t.payee_id!==checkingId)))continue;
  const incoming=t.payee_id===checkingId,saving=t.payee_id?accounts.some(a=>a._id===t.payee_id&&a.type==='Savings'):/\bto savings\b/i.test(t.description);
  transactions.push({id:`transfer-${t._id||t.id}`,payerId:t.payer_id||checkingId,medium:'balance',paymentDate:t.transaction_date,amount:t.amount,description:t.description,category:saving||incoming?'savings':categorizeMerchant('',t.description),kind:incoming?'income':saving?'saving':'purchase'});
 }
 for(const d of deposits.filter(d=>settled(d.status)&&(!d.payee_id||d.payee_id===checkingId)&&d.medium==='balance'))transactions.push({id:`deposit-${d._id}`,payerId:d.payee_id||checkingId,medium:d.medium,paymentDate:d.transaction_date,amount:d.amount,description:d.description,category:'savings',kind:'income'});
 for(const w of withdrawals.filter(w=>settled(w.status)&&(!w.payer_id||w.payer_id===checkingId)&&w.medium==='balance'))transactions.push({id:`withdrawal-${w._id}`,payerId:w.payer_id||checkingId,medium:w.medium,paymentDate:w.transaction_date,amount:w.amount,description:w.description,category:categorizeMerchant('',w.description),kind:'purchase'});
 return transactions.sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.id.localeCompare(b.id));
}
export async function syncNessie(day?:number) {
 const unit=process.env.NESSIE_AMOUNT_UNIT||'dollars';
 if(!['dollars','cents'].includes(unit)||unit==='cents'&&!process.env.NESSIE_ACCOUNT_ID)throw new Error('Check the account and amount unit in the connection settings.');
 const divisor=unit==='cents'?100:1;
 const customer=process.env.NESSIE_CUSTOMER_ID;
 const accounts=customer?await fetchCustomerAccounts(customer):await get('/accounts',z.array(accountSchema));
 const configured=process.env.NESSIE_ACCOUNT_ID;
 const checkingAccounts=accounts.filter(a=>a.type==='Checking');
 const checking=configured?checkingAccounts.find(a=>a._id===configured):checkingAccounts.length===1?checkingAccounts[0]:undefined;
 if(!checking){if(accounts.length===0)throw new Error('No transaction account exists yet. Set up an account before updating.');throw new Error('Choose a checking account in the connection settings.');}
 const id=encodeURIComponent(checking._id);
 const [purchases,transfers,deposits,withdrawals]=await Promise.all([fetchAccountPurchases(checking._id),get(`/accounts/${id}/transfers`,z.array(transferSchema),true),get(`/accounts/${id}/deposits`,z.array(depositSchema),true),get(`/accounts/${id}/withdrawals`,z.array(withdrawalSchema),true)]);
 const owned=accounts.filter(a=>!checking.customer_id||a.customer_id===checking.customer_id);
 const transactions=normalizeTransactions(checking._id,owned,purchases,transfers,deposits,withdrawals).map(t=>({...t,amount:t.amount/divisor}));
 if(day===undefined)return {balance:checking.balance/divisor,transactions,accountName:checking.nickname||checking.type};
 // Match game Day N to Day N of the most recent transaction month.
 const month=transactions.map(t=>t.paymentDate.slice(0,7)).filter(date=>/^\d{4}-\d{2}$/.test(date)).sort().at(-1);
 const selectedDate=month?`${month}-${String(day).padStart(2,'0')}`:undefined;
 return {balance:checking.balance/divisor,transactions:selectedDate?transactions.filter(t=>t.paymentDate.slice(0,10)===selectedDate):[],accountName:checking.nickname||checking.type};
}
