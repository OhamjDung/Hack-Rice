import { z } from 'zod';
import type { BankTransaction, CategoryKey } from '@/engine/Types';
const accountSchema = z.object({ _id: z.string(), nickname: z.string().optional(), balance: z.number().finite(), type: z.string() });
const purchaseSchema = z.object({ _id: z.string(), payer_id: z.string(), merchant_id: z.string().optional(), medium: z.enum(['balance', 'rewards']).default('balance'), purchase_date: z.string(), amount: z.number().nonnegative(), description: z.string().default('Purchase'), status: z.string() });
const transferSchema = z.object({ _id: z.string(), payer_id: z.string(), payee_id: z.string(), transaction_date: z.string(), amount: z.number().nonnegative(), description: z.string().default('Transfer'), status: z.string() });
async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> { const key = process.env.NESSIE_API_KEY; if (!key)
    throw new Error('Nessie is not configured. Add NESSIE_API_KEY and NESSIE_CUSTOMER_ID to .env.local.'); const base = process.env.NESSIE_BASE_URL || 'http://api.nessieisreal.com'; const url = new URL(path, base); url.searchParams.set('key', key); const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) }); if (!res.ok)
    throw new Error(`Nessie returned ${res.status}. Check your sandbox credentials.`); return schema.parse(await res.json()); }
export const fetchCustomerAccounts = (id: string) => get(`/customers/${encodeURIComponent(id)}/accounts`, z.array(accountSchema));
export const fetchAccountPurchases = (id: string) => get(`/accounts/${encodeURIComponent(id)}/purchases`, z.array(purchaseSchema));
export function categorizeMerchant(merchant: string, description: string): CategoryKey { const t = `${merchant} ${description}`.toLowerCase(); if (/rent|landlord|realty|mortgage/.test(t))
    return 'housing'; if (/electric|power|water|internet|verizon|wifi/.test(t))
    return 'utilities'; if (/uber|lyft|gas|shell|chevron|subway|transit|parking/.test(t))
    return 'transit'; if (/grocery|market|restaurant|cafe|burger|food/.test(t))
    return 'food'; return 'leisure'; }
export async function syncNessie() {
    const customer = process.env.NESSIE_CUSTOMER_ID;
    if (!customer)
        throw new Error('Add NESSIE_CUSTOMER_ID to .env.local to connect your sandbox account.');
    const accounts = await fetchCustomerAccounts(customer);
    const checking = accounts.find(a => a.type === 'Checking') || accounts[0];
    if (!checking)
        throw new Error('No Nessie accounts found for this customer.');
    const [purchases, transfers] = await Promise.all([fetchAccountPurchases(checking._id), get(`/accounts/${encodeURIComponent(checking._id)}/transfers`, z.array(transferSchema))]);
    const transactions: BankTransaction[] = purchases.filter(p => p.status === 'completed' || p.status === 'executed').map(p => ({ id: p._id, payerId: p.payer_id, medium: p.medium, paymentDate: p.purchase_date, amount: p.amount, description: p.description, category: categorizeMerchant('', p.description), kind: 'purchase' }));
    for (const t of transfers.filter(t => t.status === 'completed' || t.status === 'executed')) {
        const incoming = t.payee_id === checking._id;
        const saving = accounts.some(a => a._id === t.payee_id && a.type === 'Savings');
        transactions.push({ id: t._id, payerId: t.payer_id, medium: 'balance', paymentDate: t.transaction_date, amount: t.amount, description: t.description, category: saving || incoming ? 'savings' : 'leisure', kind: incoming ? 'income' : saving ? 'saving' : 'purchase' });
    }
    return { balance: checking.balance, transactions: transactions.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)), accountName: checking.nickname || checking.type };
}
