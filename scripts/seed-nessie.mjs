// Explicit, resumable sandbox setup. Never called by the game or during a build.
// This provider currently truncates decimal amounts, so these accounts store integer cents.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const envPath = '.env.local';
let envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.NESSIE_API_KEY) throw new Error('Set NESSIE_API_KEY in .env.local before seeding.');
const checkpoint = 'artifacts/nessie-seed-state.json';
mkdirSync('artifacts', { recursive: true });
let state = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : {};
const save = () => writeFileSync(checkpoint, JSON.stringify(state, null, 2));

async function request(path, body) {
    const url = new URL(path, 'https://api.nessieisreal.com');
    url.searchParams.set('key', env.NESSIE_API_KEY);
    let response;
    try {
        response = await fetch(url, {
            method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
        });
    } catch {
        throw new Error('Sandbox request failed. Check the account before retrying a creation with an unknown outcome.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(`Sandbox request failed (${response.status}) at ${path}.`);
    return data;
}

try {
    if (state.amountUnit !== 'cents') {
        state = { amountUnit: 'cents', customerId: state.customerId, merchantId: state.merchantId, previousSetup: state, transactions: {}, savingsDeposits: {} };
        save();
    }
    if (!state.customerId) {
        const customers = await request('/customers');
        const customer = customers.find(c => c.first_name === 'RoomEconomy' && c.last_name === 'Player')
            || (await request('/customers', { first_name: 'RoomEconomy', last_name: 'Player', address: { street_number: '6100', street_name: 'Main Street', city: 'Houston', state: 'TX', zip: '77005' } })).objectCreated;
        state.customerId = customer._id; save();
    }
    for (const type of ['Checking', 'Savings']) {
        const field = `${type.toLowerCase()}Id`;
        if (state[field]) continue;
        const nickname = `RoomEconomy ${type} Ledger`;
        const accounts = await request(`/customers/${state.customerId}/accounts`);
        const account = accounts.find(a => a.nickname === nickname && a.type === type)
            || (await request(`/customers/${state.customerId}/accounts`, { type, nickname, rewards: 0, balance: type === 'Checking' ? 300000 : 0 })).objectCreated;
        state[field] = account._id; save();
    }
    if (!state.merchantId) {
        const merchants = await request('/merchants');
        const merchant = merchants.find(m => m.name === 'RoomEconomy Everyday') || (await request('/merchants', {
            name: 'RoomEconomy Everyday', category: 'Other',
            address: { street_number: '6100', street_name: 'Main Street', city: 'Houston', state: 'TX', zip: '77005' },
            geocode: { lat: 29.7174, lng: -95.4018 },
        })).objectCreated;
        state.merchantId = merchant._id; save();
    }
    const feed = JSON.parse(readFileSync('public/mock-transactions-30-days.json', 'utf8'));
    for (const day of feed.days) {
        for (const t of day.transactions) {
            const saving = t.kind === 'saving';
            if (!state.transactions[t.id]) {
                const body = saving
                    ? { transaction_date: t.paymentDate, amount: Math.round(t.amount * 100), description: t.description, status: 'completed' }
                    : { merchant_id: state.merchantId, medium: 'balance', purchase_date: t.paymentDate, amount: Math.round(t.amount * 100), description: t.description, status: 'completed' };
                const result = await request(`/accounts/${state.checkingId}/${saving ? 'transfers' : 'purchases'}`, body);
                state.transactions[t.id] = result.objectCreated._id; save();
            }
            if (saving && !state.savingsDeposits[t.id]) {
                const result = await request(`/accounts/${state.savingsId}/deposits`, {
                    medium: 'balance', transaction_date: t.paymentDate, amount: Math.round(t.amount * 100), description: 'Savings contribution', status: 'completed',
                });
                state.savingsDeposits[t.id] = result.objectCreated._id; save();
            }
        }
    }
    for (const [name, value] of Object.entries({ NESSIE_BASE_URL: 'https://api.nessieisreal.com', NESSIE_CUSTOMER_ID: state.customerId, NESSIE_ACCOUNT_ID: state.checkingId, NESSIE_AMOUNT_UNIT: 'cents' })) {
        const line = `${name}=${value}`, pattern = new RegExp(`^${name}=.*$`, 'm');
        envText = pattern.test(envText) ? envText.replace(pattern, line) : `${envText.trimEnd()}\n${line}\n`;
    }
    writeFileSync(envPath, envText);
    console.log(`Sandbox ready: ${Object.keys(state.transactions).length} checking records across 30 days, ${Object.keys(state.savingsDeposits).length} savings deposits. Connection saved.`);
} catch (error) {
    console.error(error.message); process.exitCode = 1;
}
