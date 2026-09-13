'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Wallet, TrendingUp as TrendingUpIcon } from 'lucide-react';
import { createMarket, stepMarket, sessionDurationMs, marketFinished, marketInstrument, holdingsValue, type Market } from '@/engine/Market';
import StockChart from '@/components/canvas/StockChart';
type Account = { cash: number; holdings: Record<string, number>; cost: Record<string, number> };
type TradeLog = { ticker: string; type: 'buy' | 'sell'; qty: number; price: number };
export type TradingFloorHandle = { leaveSession: () => void };
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const clock = (ms: number) => { const total = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0'); };
// Settlement is triggered explicitly (via `leaveSession`, called by the parent's tab-switch handler) rather than
// from this effect's cleanup — React's dev Strict Mode double-invokes effect cleanup right after mount, which
// would otherwise force-settle (and permanently lock) every session the instant it opened.
const TradingFloor = forwardRef<TradingFloorHandle, { startingCash: number; onSettle: (finalCash: number, pnl: number) => void }>(function TradingFloor({ startingCash, onSettle }, ref) {
    const [initialMarket] = useState(createMarket);
    const [initialEndAt] = useState(() => Date.now() + sessionDurationMs(initialMarket));
    const marketRef = useRef<Market>(initialMarket);
    const accountRef = useRef<Account>({ cash: startingCash, holdings: {}, cost: {} });
    const durationRef = useRef(sessionDurationMs(initialMarket));
    const endAtRef = useRef(initialEndAt);
    const startValueRef = useRef(startingCash);
    const settledRef = useRef(false);
    const onSettleRef = useRef(onSettle); onSettleRef.current = onSettle;
    const [, setTick] = useState(0);
    const [active, setActive] = useState(true);
    const [qty, setQty] = useState<Record<string, number | ''>>({});
    const [msg, setMsg] = useState<Record<string, { text: string; kind: 'ok' | 'err' } | undefined>>({});
    const [history, setHistory] = useState<TradeLog[]>([]);
    const msgTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    function settle() {
        if (settledRef.current) return; settledRef.current = true;
        let cash = accountRef.current.cash;
        for (const [id, q] of Object.entries(accountRef.current.holdings)) { const inst = marketInstrument(marketRef.current, id); if (inst) cash += inst.price * q; }
        cash = round2(cash);
        accountRef.current = { cash, holdings: {}, cost: {} };
        setActive(false);
        onSettleRef.current(cash, round2(cash - startValueRef.current));
    }
    useImperativeHandle(ref, () => ({ leaveSession: settle }), []);
    useEffect(() => {
        const timer = setInterval(() => {
            if (settledRef.current) return;
            marketRef.current = stepMarket(marketRef.current);
            setTick(t => t + 1);
            if (marketFinished(marketRef.current) || Date.now() >= endAtRef.current) settle();
        }, 1000);
        const timers = msgTimers.current;
        return () => { clearInterval(timer); Object.values(timers).forEach(clearTimeout); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function showMsg(id: string, text: string, kind: 'ok' | 'err') { setMsg(m => ({ ...m, [id]: { text, kind } })); clearTimeout(msgTimers.current[id]); msgTimers.current[id] = setTimeout(() => setMsg(m => ({ ...m, [id]: undefined })), 2600); }
    function currentQty(id: string) { const q = Math.floor(Number(qty[id] ?? 1)); return Number.isFinite(q) && q > 0 ? q : 1; }
    function lastSeq(inst: { history: { seq: number }[] }) { return inst.history.length ? inst.history[inst.history.length - 1].seq : 0; }
    function buy(id: string) {
        if (!active || settledRef.current) return;
        const inst = marketInstrument(marketRef.current, id); if (!inst) return;
        const q = currentQty(id), cost = round2(q * inst.price);
        if (cost > accountRef.current.cash + 0.001) { showMsg(id, 'Not enough cash for that.', 'err'); return; }
        const acc = accountRef.current;
        acc.cash = round2(acc.cash - cost); acc.holdings[id] = (acc.holdings[id] || 0) + q; acc.cost[id] = round2((acc.cost[id] || 0) + cost);
        inst.trades.push({ seq: lastSeq(inst), type: 'buy', qty: q, price: inst.price, t: Date.now() });
        setHistory(h => [{ ticker: inst.ticker, type: 'buy' as const, qty: q, price: inst.price }, ...h].slice(0, 40));
        showMsg(id, `Bought ${q} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok'); setTick(t => t + 1);
    }
    function sell(id: string) {
        if (!active || settledRef.current) return;
        const inst = marketInstrument(marketRef.current, id); if (!inst) return;
        const q = currentQty(id), acc = accountRef.current, owned = acc.holdings[id] || 0;
        if (q > owned) { showMsg(id, `You only own ${owned} share${owned === 1 ? '' : 's'}.`, 'err'); return; }
        acc.cash = round2(acc.cash + q * inst.price);
        const remaining = owned - q;
        if (remaining > 0) { acc.holdings[id] = remaining; acc.cost[id] = round2((acc.cost[id] || 0) * remaining / owned); }
        else { delete acc.holdings[id]; delete acc.cost[id]; }
        inst.trades.push({ seq: lastSeq(inst), type: 'sell', qty: q, price: inst.price, t: Date.now() });
        setHistory(h => [{ ticker: inst.ticker, type: 'sell' as const, qty: q, price: inst.price }, ...h].slice(0, 40));
        showMsg(id, `Sold ${q} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok'); setTick(t => t + 1);
    }
    const market = marketRef.current, account = accountRef.current;
    const portfolioValue = round2(account.cash + holdingsValue(market, account.holdings));
    const remaining = endAtRef.current - Date.now();
    return <section className="trade-floor">
      <div className="how-card"><b>This is real stock data.</b> These are 6 real companies&apos; actual prices from a recent trading day, replayed slower than real time. Nothing here predicts which way a price is headed &mdash; you&apos;re watching it happen, same as any trader does.</div>
      <div className="trade-topbar">
        <div className="metric"><span className="label">Cash</span><strong>{money(account.cash)}</strong></div>
        <div className="metric"><span className="label">Portfolio</span><strong>{money(portfolioValue)}</strong></div>
        <div className={`metric timer ${remaining <= Math.min(20000, durationRef.current / 4) ? 'warn' : ''}`}><span className="label">Time left</span><strong>{active ? clock(remaining) : '00:00'}</strong></div>
        <button type="button" className="button secondary end-session" disabled={!active} onClick={settle}>End session</button>
      </div>
      {active && startValueRef.current <= 0 && <div className="locked-banner">Your brokerage account is empty. Put money into Brokerage on the Allocate tab to trade.</div>}
      {!active && <div className="locked-banner">Session ended. Your position was sold to cash &mdash; leave for the Allocate or Projection tab whenever you're ready.</div>}
      <div className="stock-grid">
        {market.stocks.map(inst => {
            const owned = account.holdings[inst.id] || 0;
            const change = inst.sessionStart ? round2(((inst.price - inst.sessionStart) / inst.sessionStart) * 100) : 0;
            const m = msg[inst.id];
            return <div className="stock-card" key={inst.id}>
              <div className="stock-head">
                <div className="who"><span className="ticker">{inst.ticker}</span><span className="name">{inst.name}</span></div>
                <div className="price-now"><span className="p">${inst.price.toFixed(2)}</span><span className="c" style={{ color: change > 0 ? 'var(--green)' : change < 0 ? 'var(--danger)' : 'var(--muted)' }}>{pct(change)}</span></div>
              </div>
              <div className="stock-body">
                <div className="stock-chart"><StockChart history={inst.history} trades={inst.trades}/></div>
                <div className="trade-col">
                  <div className="owned-line">{owned > 0 ? `${owned} share${owned === 1 ? '' : 's'} · avg $${((account.cost[inst.id] || 0) / owned).toFixed(2)}` : 'No shares owned'}</div>
                  <div className="qty-row">
                    <button type="button" onClick={() => setQty(q => ({ ...q, [inst.id]: Math.max(1, currentQty(inst.id) - 1) }))}>&minus;</button>
                    <input type="number" min="1" step="1" value={qty[inst.id] ?? 1} aria-label={`${inst.ticker} quantity`} onChange={e => setQty(q => ({ ...q, [inst.id]: e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value)) || 1) }))} onBlur={() => setQty(q => ({ ...q, [inst.id]: currentQty(inst.id) }))}/>
                    <button type="button" onClick={() => setQty(q => ({ ...q, [inst.id]: Math.max(1, currentQty(inst.id) + 1) }))}>+</button>
                    <button type="button" onClick={() => setQty(q => ({ ...q, [inst.id]: Math.max(1, Math.floor(account.cash / inst.price), owned) }))}>MAX</button>
                  </div>
                  <div className="trade-buttons"><button className="buy-btn" disabled={!active} onClick={() => buy(inst.id)}>BUY</button><button className="sell-btn" disabled={!active} onClick={() => sell(inst.id)}>SELL</button></div>
                  <div className={`trade-msg ${m?.kind ?? ''}`}>{m?.text ?? ''}</div>
                </div>
              </div>
            </div>;
        })}
      </div>
      <div className="history-feed">
        <h3><TrendingUpIcon size={15}/> Trade history</h3>
        <div className="history-list">{history.length === 0 ? <div className="history-empty">Trades you make this session show up here.</div> : history.map((tr, i) => <div className={`history-card ${tr.type}`} key={i}><span className="side">{tr.type.toUpperCase()}</span><span className="what">{tr.qty} {tr.ticker}</span><span className="at">@ ${tr.price.toFixed(2)}</span></div>)}</div>
      </div>
      <div className="notice"><Wallet size={18}/>Trading uses the cash you allocated to the brokerage account. Leaving this tab sells any open position back to cash right away.</div>
    </section>;
});
export default TradingFloor;
