'use client';
import { useState } from 'react';
import { Landmark, ArrowRight } from 'lucide-react';
import type { GameState } from '@/engine/Types';
import { spendingForecast } from '@/engine/DailyReview';
import { planAllocation, maxAllocation, currentMonthToDate, contributionLimits, type AllocationFields } from '@/engine/Investing';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FIELDS: { key: keyof AllocationFields; label: string }[] = [{ key: 'k401', label: '401(k)' }, { key: 'tradIra', label: 'Traditional IRA' }, { key: 'roth', label: 'Roth IRA' }, { key: 'brokerage', label: 'Brokerage' }];
export default function AllocationPanel({ game, onCommit }: {
    game: GameState;
    onCommit: (alloc: Partial<AllocationFields>) => void;
}) {
    const [form, setForm] = useState<AllocationFields>(() => ({ ...game.investing.lastAlloc }));
    const available = game.metrics.cashBalance, salary = game.profile.income * 12;
    const monthToDate = currentMonthToDate(game), limits = contributionLimits();
    const ctx = { salary, available, monthToDate };
    const plan = planAllocation(ctx, form);
    const essentials = spendingForecast(game).essentialsRemaining;
    const set = (field: keyof AllocationFields) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: Math.max(0, Number(e.target.value) || 0) }));
    const fillMax = (field: keyof AllocationFields) => setForm(f => ({ ...f, [field]: maxAllocation(ctx, f, field) }));
    return <section className="alloc-panel">
      <div className="inspect-total">{money(available)}<span>Available funds today &mdash; your current balance</span></div>
      <div className="notice"><Landmark size={18}/>Pre-tax 401(k) and Traditional IRA contributions cost less than face value: the tax break they create pays part of it. Contribution limits reset every game month, standing in for a year since CashBound has no calendar year.</div>
      <div className="inspect-breakdown">
        <span>401(k) used this month<b>{money(monthToDate.k401)} / {money(limits.k401)}</b></span>
        <span>IRA used this month<b>{money(monthToDate.tradIra + monthToDate.roth)} / {money(limits.ira)}</b></span>
        <span>Employer match on this visit<b>{money(plan.match)}</b></span>
      </div>
      <div className="form-grid alloc-fields">
        {FIELDS.map(({ key, label }) => <label key={key}>{label} ($)
          <span className="alloc-input-row"><input type="number" min="0" step="1" value={form[key] || ''} onChange={set(key)}/><button type="button" className="button secondary" onClick={() => fillMax(key)}>Max</button></span>
        </label>)}
      </div>
      <div className="inspect-breakdown">
        <span>Contributed<b>{money(plan.contributed)}</b></span>
        <span>Tax saved<b>{money(plan.taxSaved)}</b></span>
        <span>Real cost<b>{money(plan.cashNeeded)}</b></span>
        <span>Left after<b>{money(plan.remaining)}</b></span>
      </div>
      {plan.errors.length > 0 && <p role="alert" className="error">{plan.errors[0]}</p>}
      {plan.ok && plan.contributed > 0 && plan.remaining < essentials && <p role="alert" className="error">This leaves {money(plan.remaining)}, but rent, food, and bills still need about {money(essentials)} this month. Invested money can&apos;t be spent in the room.</p>}
      <button className="button primary full-width" disabled={!plan.ok || plan.contributed <= 0} onClick={() => onCommit(form)}>Commit this allocation<ArrowRight size={16}/></button>
    </section>;
}
