import type {GameState} from './Types.ts';
import type {DailyReview} from './DailyReview.ts';

import {CATEGORY_META} from './Constants.ts';

export function spendingJudgment(state:GameState,analysis:DailyReview['analysis']):string{
 const today=state.transactions.filter(t=>t.gameDay===state.metrics.turn);
 const purchases=today.filter(t=>t.kind==='purchase');
 const optional=purchases.some(t=>t.category==='leisure'&&!t.purpose);
 const over=purchases.find(t=>state.jars[t.category].spentAmount>state.jars[t.category].allocatedAmount+state.jars[t.category].rolloverAmount);
 if(analysis.feedback==='encouragement')return purchases.length?"You covered essentials. You're doing great; choosing needs first is helping you recover.":"You're doing great; pausing extras shows real discipline while you recover.";
 if(over)return `${CATEGORY_META[over.category].label} spending crossed your plan. That is risky; ease up before it squeezes essential bills.`;
 if(analysis.isWarning&&optional)return 'Optional purchases are putting essentials under pressure. This spending needs restraint; pause treats until the basics are safe.';
 if(analysis.isWarning&&purchases.length)return 'Covering needs is worthwhile, but the overall pace is still risky. Prioritize only the essentials you need now.';
 if(analysis.isWarning)return 'Holding off on purchases is sensible, but earlier spending still needs repair. Keep protecting essentials.';
 if(today.some(t=>t.kind==='saving'))return 'Setting money aside is a good habit. You are building a cushion while keeping essentials within reach.';
 if(purchases.some(t=>t.category==='housing'))return 'Paying rent is a responsible choice. Keeping a roof over your head deserves priority over treats.';
 if(purchases.some(t=>t.category==='utilities'))return 'Covering utilities is money well spent. Taking care of the basics helps keep your life steady.';
 if(purchases.some(t=>t.category==='food'))return 'Feeding yourself is a good priority. Your food spending fits the plan; keep meals ahead of impulse buys.';
 if(purchases.some(t=>t.category==='transit'))return 'Your transport spending fits the plan. Getting where you need to go is a sensible use of money.';
 if(purchases.some(t=>t.purpose==='gym'||t.purpose==='health'))return 'Looking after yourself is worthwhile, and this spending fits your plan. Keep making room for essentials too.';
 if(optional)return 'A little enjoyment is reasonable when essentials are protected. This treat fits your plan; keep that balance.';
 if(state.life.foodStock<25)return 'Avoiding extras is sensible, but skipping food is not a saving. Make a grocery trip your next priority.';
 if(!state.life.powerOn)return 'Holding onto cash is not enough while the lights are off. Paying utilities should come before optional purchases.';
 return 'A quiet spending day shows restraint. Keep choosing what you need before what catches your eye.';
}

export function dailyCommentary(state:GameState,analysis:DailyReview['analysis'],forecast:DailyReview['forecast']):string{
 const {day,daysRemaining:days}=forecast;
 const judgment=spendingJudgment(state,analysis);
 const purchases=state.transactions.filter(t=>t.gameDay===state.metrics.turn&&t.kind==='purchase');
 if(analysis.feedback==='encouragement'){
  if(purchases.length)return `Day ${day}: you covered essentials. You're doing great; keep protecting the next ${days} days.`;
  return [
   `You paused extras with ${days} days left. You're doing great; small choices add up.`,
   `Day ${day}: another careful day. You're doing great, even when changing old habits feels hard.`,
   `Protecting essentials shows discipline. You're doing great; keep going through these next ${days} days.`
  ][day%3];
 }
 if(analysis.isWarning||purchases.length||state.life.foodStock<25||!state.life.powerOn||state.transactions.some(t=>t.gameDay===state.metrics.turn&&t.kind==='saving'))return `Day ${day}: ${judgment}`;
 return [
  `${days} days to go. Resisting unnecessary purchases is a good habit; keep putting essentials first.`,
  `Day ${day}: no purchases today. That restraint is useful, as long as you still take care of your needs.`,
  `Day ${day}: a careful spending day. Planning meals before treats helps you stay in control.`,
  `Day ${day}: keeping spending quiet is sensible. Keep judging purchases by need, rather than impulse.`,
  `${days} days remain. You are showing restraint; keep that discipline when the next tempting purchase comes along.`
 ][day%5];
}

export type ReviewProse={commentary:string;reason:string;recoverySteps:string[]};
export function mergeReviewProse(state:GameState,local:DailyReview,prose:ReviewProse):DailyReview{
 const normalize=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const repeated=state.reviews.some(r=>normalize(r.analysis.commentary)===normalize(prose.commentary));
 const invalid=prose.commentary.trim().length===0||prose.commentary.length>160||prose.commentary.trim().split(/\s+/).length>20;
 const evaluates=/good|great|wise|sensib|responsib|careful|risk|pressure|disciplin|restraint|worthwhile|well spent|fits|balanced|smart|priorit|impuls|over.?spend|too much|steady|strain|thoughtful|healthy|protect|reasonable|reckless|unnecessary|needs? work|needs? restraint/i.test(prose.commentary);
 const technical=/\b(?:AI|Gemini|mock|Nessie|fallback|language model)\b/i;
 const unsuitable=technical.test(prose.commentary);
 const analysis={...local.analysis,...prose,commentary:repeated||invalid||!evaluates||unsuitable?local.analysis.commentary:prose.commentary};
 if(technical.test(analysis.reason))analysis.reason=local.analysis.reason;
 if(analysis.recoverySteps.some(step=>technical.test(step)))analysis.recoverySteps=local.analysis.recoverySteps;
 // Keep the financial assessment grounded while letting the prose change daily.
 if(local.analysis.feedback==='encouragement'||local.analysis.ending!=='none')analysis.reason=local.analysis.reason;
 return {...local,source:'gemini',analysis};
}
