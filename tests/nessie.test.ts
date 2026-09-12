import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncNessie } from '../src/lib/nessieClient.ts';
import { importBankDay, bankTransactionsUpdatedToday } from '../src/engine/TransactionUpdates.ts';
import { importMockDay, mockFeedSchema } from '../src/engine/MockFeed.ts';
import { createGame } from '../src/engine/RulesEngine.ts';
import { stateSchema } from '../src/engine/Types.ts';
import { rewindRun } from '../src/engine/Recovery.ts';

const accounts = [
    { _id: 'checking', type: 'Checking', balance: 3000, customer_id: 'player' },
    { _id: 'savings', type: 'Savings', balance: 0, customer_id: 'player' },
];
const purchase = { _id: 'p1', payer_id: 'checking', medium: 'balance', purchase_date: '2026-09-03', amount: 18, description: 'Transit pass top-up', status: 'completed' };

function service(t: TestContext, data: Record<string, unknown>) {
    const names = ['NESSIE_API_KEY', 'NESSIE_BASE_URL', 'NESSIE_CUSTOMER_ID', 'NESSIE_ACCOUNT_ID', 'NESSIE_AMOUNT_UNIT'];
    const previous = names.map(n => process.env[n]);
    process.env.NESSIE_API_KEY = 'test-key'; process.env.NESSIE_BASE_URL = 'http://api.nessieisreal.com';
    delete process.env.NESSIE_CUSTOMER_ID; delete process.env.NESSIE_ACCOUNT_ID; delete process.env.NESSIE_AMOUNT_UNIT;
    t.after(() => names.forEach((n, i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i]; }));
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        const url = new URL(String(input));
        assert.equal(url.protocol, 'https:'); assert.equal(url.searchParams.get('key'), 'test-key');
        const value = data[url.pathname];
        return value === undefined ? Response.json('No transactions found for this account', { status: 404 }) : Response.json(value);
    });
}

test('live format selects only Day 3; empty transfer 404 is accepted', async t => {
    service(t, { '/accounts': accounts, '/accounts/checking/purchases': [purchase, { ...purchase, _id: 'p2', purchase_date: '2026-09-04' }] });
    const data = await syncNessie(3);
    assert.equal(data.transactions.length, 1); assert.equal(data.transactions[0].category, 'transit');
    assert.equal(data.balance, 3000);
    const state = createGame(); state.metrics.turn = 3;
    const next = importBankDay(state, data.transactions);
    assert.equal(next.metrics.cashBalance, 2982); assert.equal(next.transactions[0].gameDay, 3);
    assert.equal(importBankDay(next, data.transactions), next);
    assert.equal(bankTransactionsUpdatedToday(stateSchema.parse(JSON.parse(JSON.stringify(next)))) , true);
});

test('current transfer, deposit and withdrawal responses omit account parties', async t => {
    service(t, { '/accounts': accounts,
        '/accounts/checking/transfers': [{ id: 't1', transaction_date: '2026-09-06', amount: 100, description: 'Transfer to savings', status: 'completed' }],
        '/accounts/checking/deposits': [{ _id: 'd1', transaction_date: '2026-09-06', medium: 'balance', amount: 200, status: 'executed' }],
        '/accounts/checking/withdrawals': [{ _id: 'w1', transaction_date: '2026-09-06', medium: 'balance', amount: 20, status: 'completed' }],
    });
    const data = await syncNessie(6);
    assert.deepEqual(data.transactions.map(v => v.kind).sort(), ['income', 'purchase', 'saving']);
    const state = createGame(); state.metrics.turn = 6;
    const next = importBankDay(state, data.transactions);
    assert.equal(next.savedTotal, 100); assert.equal(next.metrics.cashBalance, 3080);
});

test('legacy transfers distinguish incoming funds, owned savings, unrelated and self transfers', async t => {
    const base = { transaction_date: '2026-09-06', amount: 100, description: 'Transfer', status: 'completed' };
    service(t, { '/accounts': accounts, '/accounts/checking/transfers': [
        { ...base, _id: 'in', payer_id: 'outside', payee_id: 'checking' },
        { ...base, _id: 'save', payer_id: 'checking', payee_id: 'savings' },
        { ...base, _id: 'out', payer_id: 'checking', payee_id: 'outside' },
        { ...base, _id: 'self', payer_id: 'checking', payee_id: 'checking' },
        { ...base, _id: 'other', payer_id: 'outside', payee_id: 'someone' },
    ] });
    const result = await syncNessie();
    assert.deepEqual(Object.fromEntries(result.transactions.map(v => [v.id, v.kind])), { 'transfer-in': 'income', 'transfer-out': 'purchase', 'transfer-save': 'saving' });
});

test('pending, cancelled and rewards purchases never debit cash', async t => {
    service(t, { '/accounts': accounts, '/accounts/checking/purchases': [
        purchase, { ...purchase, _id: 'pending', status: 'pending' }, { ...purchase, _id: 'cancelled', status: 'cancelled' },
        { ...purchase, _id: 'rewards', medium: 'rewards' },
    ] });
    assert.equal((await syncNessie()).transactions.length, 1);
});

test('integer-cent sandbox accounts preserve fractional purchases and scale the balance once', async t => {
    service(t, { '/accounts': [{ ...accounts[0], balance: 300000 }], '/accounts/checking/purchases': [{ ...purchase, amount: 850 }] });
    process.env.NESSIE_ACCOUNT_ID = 'checking'; process.env.NESSIE_AMOUNT_UNIT = 'cents';
    const data = await syncNessie(3);
    assert.equal(data.balance, 3000); assert.equal(data.transactions[0].amount, 8.5);
    assert.equal(importBankDay(createGame(), data.transactions).metrics.cashBalance, 2991.5);
});

test('empty days stay retryable; invalid responses produce a safe error', async t => {
    service(t, { '/accounts': accounts });
    const data = await syncNessie(3); const state = createGame();
    assert.equal(importBankDay(state, data.transactions), state);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ wrong: true }));
    await assert.rejects(syncNessie(), /unreadable update/);
});

test('an explicit checking account is required when multiple accounts exist', async t => {
    service(t, { '/accounts': [...accounts, { ...accounts[0], _id: 'second' }] });
    await assert.rejects(syncNessie(), /Choose a checking account/);
    process.env.NESSIE_ACCOUNT_ID = 'checking';
    assert.equal((await syncNessie()).balance, 3000);
});

test('switching a saved file day to the bank does not replay its spending or rewards', async t => {
    const feed = mockFeedSchema.parse(JSON.parse(readFileSync(new URL('../public/mock-transactions-30-days.json', import.meta.url), 'utf8')));
    const state = createGame(); state.metrics.turn = 3;
    const old = importMockDay(state, feed);
    service(t, { '/accounts': accounts, '/accounts/checking/purchases': [purchase] });
    const next = importBankDay(old, (await syncNessie(3)).transactions);
    assert.equal(next.metrics.cashBalance, old.metrics.cashBalance);
    assert.equal(next.transactions.length, old.transactions.length);
    assert.deepEqual(next.jars, old.jars); assert.deepEqual(next.progression, old.progression);
    assert.equal(next.transactions[0].origin, 'nessie'); assert.equal(next.transactions[0].id, 'purchase-p1');
});

test('stale updates are rejected, rewind permits replay, and later months do not repeat bank IDs', async t => {
    service(t, { '/accounts': accounts, '/accounts/checking/purchases': [purchase] });
    const rows = (await syncNessie(3)).transactions;
    const state = createGame(); state.metrics.turn = 3;
    assert.equal(importBankDay(state, rows, 2), state);
    const first = importBankDay(state, rows);
    const rewound = rewindRun(first);
    assert.equal(bankTransactionsUpdatedToday(rewound), false);
    assert.equal(importBankDay(rewound, rows).metrics.cashBalance, first.metrics.cashBalance);
    first.metrics.turn = 33;
    const next = importBankDay(first, rows);
    assert.equal(next.metrics.cashBalance, first.metrics.cashBalance); assert.equal(next.transactions.length, 1);
});
