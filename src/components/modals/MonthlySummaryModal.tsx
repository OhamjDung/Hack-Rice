'use client';
import Modal from '@/components/ui/Modal';
import type {GameState} from '@/engine/Types';
import {monthlySummary} from '@/engine/MonthlySummary';
import {money} from '@/components/hud/TopStatusBar';

export default function MonthlySummaryModal({game,onClose,onContinue}:{game:GameState;onClose:()=>void;onContinue:()=>void}){
 const summary=monthlySummary(game);
 return <Modal title={`Month ${summary.month} in review`} onClose={onClose}>
  <p className="muted">A moment to look back before the next chapter. These totals are before month-end bills, salary, and budget rollover are settled.</p>
  <dl className="month-totals"><div><dt>Spent</dt><dd>{money(summary.spent)}</dd></div><div><dt>Saved this month</dt><dd>{money(summary.saved)}</dd></div><div><dt>Cash remaining</dt><dd>{money(summary.cash)}</dd></div></dl>
  <div className="month-table"><table><caption>Your monthly budget</caption><thead><tr><th scope="col">Category</th><th scope="col">Plan</th><th scope="col">Used</th></tr></thead><tbody>{summary.rows.map(row=><tr key={row.category}><th scope="row">{row.label}{row.category==='savings'&&<small>Transfer, not spending</small>}</th><td>{money(row.budget)}</td><td>{money(row.spent)}{row.spent>row.budget&&<small>Over plan</small>}</td></tr>)}</tbody></table></div>
  <div className="forecast-content"><h3>What went well</h3>{summary.wins.length?<ul>{summary.wins.map(win=><li key={win}>{win}</li>)}</ul>:<p>You made it to the month-end review. Take what you learned into your next choices.</p>}<h3>For the month ahead</h3><ul>{summary.steps.map(step=><li key={step}>{step}</li>)}</ul></div>
  <p className="muted">{game.mode==='demo'?'Continuing settles this month and adds your next paycheck if the run continues.':'Continuing settles this month. Your next income arrives through connected transactions.'}</p>
  <button className="button primary full-width" onClick={onContinue}>Finish month {summary.month} &amp; continue</button>
 </Modal>;
}
