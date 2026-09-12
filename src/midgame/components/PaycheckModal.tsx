import { useMemo, useState } from 'react';
import type { MidgameState, PendingAllocation } from '../types';
import { MATCH_CAP } from '../constants';

interface Props {
  state: MidgameState;
  matchFor: (contribution: number) => number;
  iraRemainingCap: number;
  onAllocate: (alloc: PendingAllocation, bills: number) => void;
}

export default function PaycheckModal({ state, matchFor, iraRemainingCap, onAllocate }: Props) {
  const paycheck = state.pendingPaycheck ?? 0;
  const bills = state.monthlyExpenses;
  const autoAmounts = useMemo(() => ({
    four01k: state.automations.four01k ? MATCH_CAP : 0,
    ira: state.automations.ira ? Math.min(iraRemainingCap, 300) : 0,
  }), [state.automations, iraRemainingCap]);

  const [four01k, setFour01k] = useState(!state.automationInterrupted.four01k ? autoAmounts.four01k : 0);
  const [ira, setIra] = useState(!state.automationInterrupted.ira ? autoAmounts.ira : 0);
  const [investNow, setInvestNow] = useState(0);

  const afterBills = Math.max(0, paycheck - bills);
  const allocated = four01k + ira + investNow;
  const cashReserve = Math.max(0, afterBills - allocated);
  const over = allocated > afterBills;
  const match = matchFor(four01k);

  const four01kAutomated = state.automations.four01k && !state.automationInterrupted.four01k;
  const iraAutomated = state.automations.ira && !state.automationInterrupted.ira;

  return (
    <dialog open className="mg-modal">
      <h2>Paycheck day — ${paycheck.toFixed(2)}</h2>
      <p className="mg-muted">Bills (${bills.toFixed(0)}) are deducted automatically. Allocate the rest.</p>

      <label>
        401(k) — matches 50% up to ${MATCH_CAP} (+${match.toFixed(0)} free)
        <input type="number" min={0} max={afterBills} value={four01k} disabled={four01kAutomated}
          onChange={e => setFour01k(Number(e.target.value))} />
      </label>

      <label>
        IRA — ${iraRemainingCap.toFixed(0)} left this year
        <input type="number" min={0} max={Math.min(iraRemainingCap, afterBills)} value={ira} disabled={iraAutomated}
          onChange={e => setIra(Number(e.target.value))} />
      </label>

      <label>
        Invest now (medium tier, compounds)
        <input type="number" min={0} value={investNow} onChange={e => setInvestNow(Number(e.target.value))} />
      </label>

      <p className={over ? 'mg-error' : 'mg-muted'}>
        Cash Reserve (spend freely on Food/Happiness this round): ${cashReserve.toFixed(2)}
        {over ? ' — over-allocated, reduce a bucket' : ''}
      </p>

      <div className="mg-modal-actions">
        <button className="mg-button mg-primary" disabled={over}
          onClick={() => onAllocate({ four01k, ira, cashReserve, investNow }, bills)}>
          Lock in allocation
        </button>
      </div>
    </dialog>
  );
}
