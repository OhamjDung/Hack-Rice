'use client';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { GameState } from '@/engine/Types';
import { projectRetirement, PROJECTION_YEARS_RANGE, PAY_FREQUENCIES, type PayFrequency } from '@/engine/Investing';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FREQUENCY_LABEL: Record<PayFrequency, string> = { weekly: 'Weekly', biweekly: 'Biweekly', semiMonthly: 'Semi-monthly', monthly: 'Monthly' };
const FREQUENCY_ADVERB: Record<PayFrequency, string> = { weekly: 'weekly', biweekly: 'every two weeks', semiMonthly: 'twice a month', monthly: 'monthly' };
export default function ProjectionPanel({ game }: {
    game: GameState;
}) {
    const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
    const [years, setYears] = useState(10);
    const hasAlloc = !!game.investing.today;
    const projection = projectRetirement(game, frequency, years);
    const setYearsInput = (raw: string) => setYears(Math.max(PROJECTION_YEARS_RANGE.min, Math.min(PROJECTION_YEARS_RANGE.max, Math.round(Number(raw)) || PROJECTION_YEARS_RANGE.min)));
    return <section className="projection-panel">
      <div className="section-heading"><h3><TrendingUp size={16}/> If you kept this up</h3>
        <div className="projection-frequency">{(Object.keys(PAY_FREQUENCIES) as PayFrequency[]).map(f => <button key={f} type="button" className={`button secondary ${frequency === f ? 'selected' : ''}`} onClick={() => setFrequency(f)}>{FREQUENCY_LABEL[f]}</button>)}</div>
      </div>
      {!hasAlloc && <p className="muted">Commit an allocation on the Allocate tab first to see a projection based on today's contribution.</p>}
      <div className="table-scroll"><table className="projection-table"><thead><tr><th>Account</th><th className="present-col">Present</th><th className="years-col"><label className="years-field">Years from now<input type="number" min={PROJECTION_YEARS_RANGE.min} max={PROJECTION_YEARS_RANGE.max} step="1" value={years} onChange={e => setYearsInput(e.target.value)}/></label></th></tr></thead>
        <tbody>
          <tr><td>401(k)</td><td className="present-col">{money(projection.present.k401)}</td><td>{money(projection.rows.k401)}</td></tr>
          <tr><td>Traditional IRA</td><td className="present-col">{money(projection.present.tradIra)}</td><td>{money(projection.rows.tradIra)}</td></tr>
          <tr><td>Roth IRA</td><td className="present-col">{money(projection.present.roth)}</td><td>{money(projection.rows.roth)}</td></tr>
          <tr className="projection-total"><td>Total</td><td className="present-col">{money(projection.presentTotal)}</td><td>{money(projection.total)}</td></tr>
        </tbody>
      </table></div>
      <p className="muted">Present is what your past allocations have actually grown into so far &mdash; it updates each time a game month closes, so it's worth checking back on.</p>
      <div className="notice"><TrendingUp size={18}/>This is an estimate based on a 7%/year average, compounding {FREQUENCY_ADVERB[frequency]} at today's contribution &mdash; not a guarantee, and not a randomized outcome.</div>
      <p className="muted">Brokerage: {money(projection.brokerageToday)} in stocks today. Not included above &mdash; trading results aren't a fixed rate the way retirement accounts are.</p>
    </section>;
}
