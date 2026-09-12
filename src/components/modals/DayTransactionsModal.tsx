'use client';
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { money } from '@/components/hud/TopStatusBar';
import { CATEGORY_META } from '@/engine/Constants';
import { dayOfMonth, monthOfRun } from '@/engine/DailyReview';
import type { BankTransaction, GameState } from '@/engine/Types';
import { responseSchema, syncOutput } from '@/schemas/api';

export default function DayTransactionsModal({ game, turn, onClose }: {
    game: GameState; turn: number; onClose: () => void;
}) {
    const updated = game.mode === 'nessie' && !!game.transactionUpdateTurns?.includes(turn);
    const [available, setAvailable] = useState<BankTransaction[]>([]);
    const [loading, setLoading] = useState(!updated);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (updated) { setLoading(false); return; }
        const controller = new AbortController();
        setLoading(true); setError('');
        async function load() {
            try {
                const res = await fetch(`/api/nessie/sync?day=${dayOfMonth(turn)}`, {
                    cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]),
                });
                if (!res.ok) throw new Error('Could not load new transactions. Your recorded entries are shown below.');
                const { data } = responseSchema(syncOutput).parse(await res.json());
                if (!controller.signal.aborted) setAvailable(data.transactions);
            } catch {
                if (!controller.signal.aborted) setError('Could not load new transactions. You can still view any recorded entries.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [turn, updated, attempt]);

    const recorded = game.transactions.filter(t => t.gameDay === turn);
    const pending = available.filter(t => !game.transactions.some(old => old.id === t.id)
        && !recorded.some(old => old.origin === 'mock' && old.description === t.description && old.amount === t.amount && old.kind === t.kind));
    const rows = [...recorded.map(t => ({ ...t, recorded: true })), ...pending.map(t => ({ ...t, recorded: false }))];
    const total = (kind: BankTransaction['kind']) => rows.filter(t => t.kind === kind).reduce((sum, t) => sum + t.amount, 0);

    return <Modal title={turn === game.metrics.turn ? "Today's transactions" : "Previous day's transactions"} onClose={onClose}>
        <p className="muted">Month {monthOfRun(turn)} · Day {dayOfMonth(turn)} / 30</p>
        {loading && <p className="muted" role="status">Loading transactions…</p>}
        {error && <div className="day-transactions-error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>}
        {!!rows.length && <>
            <dl className="day-transaction-totals">
                <div><dt>Spent</dt><dd>{money(total('purchase'))}</dd></div>
                <div><dt>Saved</dt><dd>{money(total('saving'))}</dd></div>
                <div><dt>Received</dt><dd>{money(total('income'))}</dd></div>
            </dl>
            <ul className="day-transactions" aria-label="Transactions for this day">
                {rows.map(t => <li key={t.id}>
                    <span className="day-transaction-icon" aria-hidden="true">{t.kind === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span>
                    <div><strong>{t.description}</strong><small>{CATEGORY_META[t.category].label} · {t.recorded ? 'Recorded' : 'Not added'}</small></div>
                    <b>{t.kind === 'income' ? '+' : '−'}{money(t.amount)}</b>
                </li>)}
            </ul>
            {!!pending.length && <p className="muted">{turn === game.metrics.turn ? "Use Keep updated with transactions to add today's new entries." : "Entries marked Not added were not included in your game balance."}</p>}
        </>}
        {!loading && !rows.length && <div className="empty-state"><ReceiptText size={25} aria-hidden="true"/><p>{error ? 'No recorded transactions for this day.' : 'No transactions for this day yet.'}</p></div>}
    </Modal>;
}
