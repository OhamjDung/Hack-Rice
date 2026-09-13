import { useState } from 'react';
import type { UserProfile, RankingRequest, RankingResult } from '../types';
import { readMainGameAnnualIncome } from '../mainGameLink';

interface Props { onSubmit: (profile: UserProfile, annualGross: number, ranking: RankingResult) => void }

export default function ProfileIntakeForm({ onSubmit }: Props) {
  const [linkedIncome] = useState(readMainGameAnnualIncome);
  const [age, setAge] = useState(28);
  const [income, setIncome] = useState(linkedIncome ?? 65000);
  const [filingStatus, setFilingStatus] = useState<UserProfile['filingStatus']>('single');
  const [dependents, setDependents] = useState(0);
  const [jobStatus, setJobStatus] = useState<UserProfile['jobStatus']>('employed');
  const [riskTolerance, setRiskTolerance] = useState<UserProfile['riskTolerance']>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const profile: UserProfile = { age, filingStatus, dependents, jobStatus, riskTolerance };
    const request: RankingRequest = { age, income, jobStatus, dependents, existingAccounts: [], riskTolerance };
    try {
      const res = await fetch('/api/rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const ranking: RankingResult = await res.json();
      onSubmit(profile, income, ranking);
    } catch {
      setError('Could not reach the ranking service — starting with the default concept order instead.');
      onSubmit(profile, income, { order: [], reasoning: {}, instructions: {}, source: 'fallback', disclaimer: 'Educational tool only — not financial advice.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog open className="fg-modal">
      <h2>Tell us about you</h2>
      <p className="fg-muted" style={{ marginBottom: 13 }}>This shapes which concepts unlock first. Educational only — not financial advice.</p>

      <label>Age
        <input type="number" min={13} max={100} value={age} onChange={e => setAge(Number(e.target.value))} />
      </label>
      <label>Annual income ($)
        <input type="number" min={0} value={income} onChange={e => setIncome(Number(e.target.value))} />
      </label>
      {linkedIncome != null && <p className="fg-muted" style={{ marginTop: -9, marginBottom: 13 }}>Prefilled from your main game income — adjust if it's changed.</p>}
      <label>Filing status
        <select value={filingStatus} onChange={e => setFilingStatus(e.target.value as UserProfile['filingStatus'])}>
          <option value="single">Single</option>
          <option value="married_joint">Married filing jointly</option>
        </select>
      </label>
      <label>Dependents
        <input type="number" min={0} max={20} value={dependents} onChange={e => setDependents(Number(e.target.value))} />
      </label>
      <label>Job status
        <select value={jobStatus} onChange={e => setJobStatus(e.target.value as UserProfile['jobStatus'])}>
          <option value="employed">Employed</option>
          <option value="self_employed">Self-employed</option>
          <option value="unemployed">Unemployed</option>
          <option value="student">Student</option>
        </select>
      </label>
      <label>Risk tolerance
        <select value={riskTolerance} onChange={e => setRiskTolerance(e.target.value as UserProfile['riskTolerance'])}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>

      {error && <p className="fg-error">{error}</p>}
      <div className="fg-modal-actions">
        <button className="fg-button fg-primary" disabled={loading} onClick={submit}>{loading ? 'Ranking...' : 'Start'}</button>
      </div>
    </dialog>
  );
}
