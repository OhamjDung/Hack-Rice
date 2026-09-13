'use client';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { GameState } from '@/engine/Types';
import { projectRetirement, PROJECTION_HORIZONS, PAY_FREQUENCIES, type PayFrequency } from '@/engine/Investing';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FREQUENCY_LABEL: Record<PayFrequency, string> = { weekly: 'Weekly', biweekly: 'Biweekly', semiMonthly: 'Semi-monthly', monthly: 'Monthly' };
const FREQUENCY_ADVERB: Record<PayFrequency, string> = { weekly: 'weekly', biweekly: 'every two weeks', semiMonthly: 'twice a month', monthly: 'monthly' };
export default function ProjectionPanel({ game }: {
    game: GameState;
}) {
    const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
    const hasAlloc = !!game.investing.today;
    const projection = projectRetirement(game, frequency);
    return <section className="projection-panel">
      <div className="section-heading"><h3><TrendingUp size={16}/> If you kept this up</h3>
        <div className="projection-frequency">{(Object.keys(PAY_FREQUENCIES) as PayFrequency[]).map(f => <button key={f} type="button" className={`button secondary ${frequency === f ? 'selected' : ''}`} onClick={() => setFrequency(f)}>{FREQUENCY_LABEL[f]}</button>)}</div>
      </div>
      {!hasAlloc && <p className="muted">Commit an allocation on the Allocate tab first to see a projection based on today's contribution.</p>}
      <div className="table-scroll"><table className="projection-table"><thead><tr><th>Account</th>{PROJECTION_HORIZONS.map(y => <th key={y}>{y} yr</th>)}</tr></thead>
        <tbody>
          <tr><td>401(k)</td>{projection.rows.k401.map((v, i) => <td key={i}>{money(v)}</td>)}</tr>
          <tr><td>Traditional IRA</td>{projection.rows.tradIra.map((v, i) => <td key={i}>{money(v)}</td>)}</tr>
          <tr><td>Roth IRA</td>{projection.rows.roth.map((v, i) => <td key={i}>{money(v)}</td>)}</tr>
          <tr className="projection-total"><td>Total</td>{projection.total.map((v, i) => <td key={i}>{money(v)}</td>)}</tr>
        </tbody>
      </table></div>
      <div className="notice"><TrendingUp size={18}/>This is an estimate based on a 7%/year average, compounding {FREQUENCY_ADVERB[frequency]} at today's contribution &mdash; not a guarantee, and not a randomized outcome.</div>
      <p className="muted">Brokerage: {money(projection.brokerageToday)} in stocks today. Not included above &mdash; trading results aren't a fixed rate the way retirement accounts are.</p>
    </section>;
}
