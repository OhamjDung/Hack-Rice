import type { BankTransaction, GameState } from './Types.ts';
import { applyTransactions } from './RulesEngine.ts';

export function bankTransactionsUpdatedToday(state: GameState): boolean {
    return state.mode === 'nessie' && (state.transactionUpdateTurns?.includes(state.metrics.turn) ?? false);
}

export function importBankDay(state: GameState, transactions: BankTransaction[], expectedTurn = state.metrics.turn): GameState {
    if (state.isGameOver || expectedTurn !== state.metrics.turn || bankTransactionsUpdatedToday(state)) return state;
    if (!transactions.length) return state;
    const source = structuredClone(state);
    const used = new Set(source.transactions.map(t => t.id));
    // Adopt bank IDs for expenses already imported from the old file without replaying their effects.
    for (const t of transactions) {
        if (used.has(t.id)) continue;
        const previous = source.transactions.find(old => old.origin === 'mock'
            && (old.gameDay === expectedTurn || (old.gameDay === undefined && old.paymentDate.slice(0, 10) === t.paymentDate.slice(0, 10)))
            && old.amount === t.amount && old.description === t.description && old.kind === t.kind);
        if (previous) { previous.id = t.id; previous.payerId = t.payerId; previous.origin = 'nessie'; used.add(t.id); }
    }
    // The account balance includes future/skipped days; only today's cashflow affects the game.
    const next = applyTransactions({ ...source, mode: 'nessie' }, transactions.map(t => ({ ...t, gameDay: expectedTurn })), undefined, 'nessie');
    return { ...next, transactionUpdateTurns: [...new Set([...(source.transactionUpdateTurns ?? []), expectedTurn])] };
}
