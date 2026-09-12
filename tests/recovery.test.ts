import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyTransactions, advanceTurn } from '../src/engine/RulesEngine.ts';
import { stateSchema, type BankTransaction } from '../src/engine/Types.ts';
import { localDailyReview, applyDailyReview } from '../src/engine/DailyReview.ts';
import { rewindRun } from '../src/engine/Recovery.ts';

const purchase: BankTransaction = { id: 'bad-buy', payerId: 'demo', medium: 'balance', paymentDate: 'today', amount: 2000, description: 'Shopping', category: 'leisure', kind: 'purchase' };

test('rewind persists and restores the complete state before risky spending', () => {
 const original = createGame();
 const spent = applyTransactions(original, [purchase]);
 const ended = applyDailyReview(advanceTurn(spent), localDailyReview(spent, 'close'));
 assert.equal(ended.isGameOver, true);
 const saved = stateSchema.parse(JSON.parse(JSON.stringify(ended)));
 const rewound=rewindRun(saved);
 assert.deepEqual(rewound.metrics, original.metrics);
 assert.deepEqual(rewound.jars, original.jars);
 assert.deepEqual(rewound.transactions, []);
 assert.deepEqual(rewound.reviews, []);
 assert.equal(rewound.command.severity, 'info');
 assert.equal(rewound.coachingBaseline?.review.assessedDay, 1);
 assert.equal(stateSchema.parse(JSON.parse(JSON.stringify(rewound))).coachingBaseline?.optionalSpent, 2000);
 assert.equal(ended.transactions.length, 1);
});

test('later essential purchases and duplicate syncs preserve the risky checkpoint', () => {
 const spent = applyTransactions(createGame(), [purchase]);
 const next = applyTransactions(spent, [{ ...purchase, id: 'food', category: 'food', amount: 20 }]);
 assert.equal(rewindRun(next).transactions.length, 0);
 assert.deepEqual(applyTransactions(next, [purchase]).rewindCheckpoint, next.rewindCheckpoint);
});

test('old saves load without a checkpoint and bank rewinds become local simulations', () => {
 const original = stateSchema.parse(createGame());
 assert.equal(rewindRun(original), original);
 const connected = { ...original, mode: 'nessie' as const };
 assert.equal(rewindRun(applyTransactions(connected, [purchase], 1000, 'nessie')).mode, 'demo');
});
