import type { RoundSummaryData } from '../types';

export default function RoundSummary({ summary, onContinue }: { summary: RoundSummaryData; onContinue: () => void }) {
  return (
    <dialog open className="mg-modal">
      <h2>Round complete</h2>
      <ul className="mg-summary-list">
        <li>Match efficiency: {summary.efficiency.toFixed(0)}%</li>
        <li>Match streak: {summary.matchStreak}</li>
        <li>Happiness: {summary.happiness.toFixed(0)}</li>
        <li>Food: {summary.foodMet ? 'met' : 'missed'}</li>
        <li>Net worth: ${summary.netWorth.toFixed(0)}</li>
      </ul>
      <p className="mg-coach-tip">{summary.coachTip}</p>
      <div className="mg-modal-actions">
        <button className="mg-button mg-primary" onClick={onContinue}>Next paycheck</button>
      </div>
    </dialog>
  );
}
