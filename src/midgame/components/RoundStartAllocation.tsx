import { useState } from 'react';
import type { MidgameState, PendingAllocation } from '../types';
import { matchFor, iraRemainingCap } from '../state/selectors';
import { config } from '../config';
import { useDragChip } from '../hooks/useDragChip';

interface AllocateProps {
  mode: 'allocate';
  state: MidgameState;
  onAllocate: (alloc: PendingAllocation) => void;
}

interface CorrectionProps {
  mode: 'correction';
  overContribution: number;
  onResolve: () => void;
}

type Props = AllocateProps | CorrectionProps;

// Paycheck-day allocation screen. Reused in 'correction' mode for the audit
// event (Section 9: drag the excess out of the over-capped bucket), so the
// player learns one gesture for both.
export default function RoundStartAllocation(props: Props) {
  if (props.mode === 'correction') return <CorrectionView {...props} />;
  return <AllocateView {...props} />;
}

function AllocateView({ state, onAllocate }: AllocateProps) {
  const paycheck = state.round.paycheckAmount ?? 0;
  const bills = state.round.billsAmount;
  const remainingIraCap = iraRemainingCap(state);
  const four01kAutomated = state.player.automations.four01k.state === 'automated';
  const iraAutomated = state.player.automations.ira.state === 'automated';

  const [four01k, setFour01k] = useState(four01kAutomated ? config.matchCap : 0);
  const [ira, setIra] = useState(iraAutomated ? Math.min(remainingIraCap, 300) : 0);
  const [investNow, setInvestNow] = useState(0);
  const [cashReserve, setCashReserve] = useState(0);

  const afterBills = Math.max(0, paycheck - bills);
  const allocated = four01k + ira + investNow + cashReserve;
  const leftover = Math.max(0, afterBills - four01k - ira);
  const unassigned = Math.max(0, leftover - investNow - cashReserve);
  const over = allocated > afterBills;
  const match = matchFor(four01k);

  const { dragging, position, chipProps } = useDragChip({
    amount: unassigned,
    onDrop: (dropId) => {
      if (dropId === 'invest-now') setInvestNow(v => v + unassigned);
      if (dropId === 'cash-reserve') setCashReserve(v => v + unassigned);
    },
  });

  return (
    <dialog open className="mg-modal">
      <h2>Paycheck day — ${paycheck.toFixed(2)}</h2>
      <p className="mg-muted">Bills (${bills.toFixed(0)}) are deducted automatically. Allocate the rest.</p>

      <label>
        401(k) — matches {(config.matchPercent * 100).toFixed(0)}% up to ${config.matchCap} (+${match.toFixed(0)} free)
        <span className="mg-slider-row">
          <input type="range" min={0} max={Math.max(afterBills, 0)} step={10} value={four01k} disabled={four01kAutomated}
            onChange={e => setFour01k(Number(e.target.value))} />
          <span className="mg-slider-value">${four01k}</span>
        </span>
      </label>

      <label>
        IRA — ${remainingIraCap.toFixed(0)} left this year
        <span className="mg-slider-row">
          <input type="range" min={0} max={Math.max(Math.min(remainingIraCap, afterBills), 0)} step={10} value={ira} disabled={iraAutomated}
            onChange={e => setIra(Number(e.target.value))} />
          <span className="mg-slider-value">${ira}</span>
        </span>
      </label>

      {unassigned > 0 && (
        <div className="mg-drop-zone-row">
          <div className="mg-cash-chip" {...chipProps}>${unassigned.toFixed(0)}</div>
          <div className="mg-drop-target" data-drop-target="cash-reserve">Cash Reserve<br />(spend freely)</div>
          <div className="mg-drop-target" data-drop-target="invest-now">Invest Now<br />(compounds)</div>
        </div>
      )}
      {dragging && position && (
        <div className="mg-cash-chip mg-cash-chip-ghost" style={{ left: position.x, top: position.y }}>${unassigned.toFixed(0)}</div>
      )}

      <p className={over ? 'mg-error' : 'mg-muted'}>
        Cash Reserve: ${cashReserve.toFixed(2)} · Invested: ${investNow.toFixed(2)}
        {over ? ' — over-allocated, reduce a bucket' : ''}
      </p>

      <div className="mg-modal-actions">
        <button className="mg-button mg-primary" disabled={over || unassigned > 0}
          onClick={() => onAllocate({ four01k, ira, cashReserve, investNow })}>
          Lock in allocation
        </button>
      </div>
    </dialog>
  );
}

function CorrectionView({ overContribution, onResolve }: CorrectionProps) {
  const { dragging, position, chipProps } = useDragChip({
    amount: overContribution,
    onDrop: (dropId) => { if (dropId === 'cash-reserve') onResolve(); },
  });
  return (
    <dialog open className="mg-modal">
      <h2>Audit — IRA over contribution</h2>
      <p className="mg-muted">You contributed ${overContribution.toFixed(2)} over this year's cap. Drag the excess back to Cash Reserve.</p>
      <div className="mg-drop-zone-row">
        <div className="mg-cash-chip" {...chipProps}>${overContribution.toFixed(0)}</div>
        <div className="mg-drop-target" data-drop-target="cash-reserve">Cash Reserve</div>
      </div>
      {dragging && position && (
        <div className="mg-cash-chip mg-cash-chip-ghost" style={{ left: position.x, top: position.y }}>${overContribution.toFixed(0)}</div>
      )}
    </dialog>
  );
}
