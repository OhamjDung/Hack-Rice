import type {GameState} from './Types.ts';
import {CATEGORY_META} from './Constants.ts';
import {dayOfMonth,spendingForecast} from './DailyReview.ts';

export function endingAdvice(state:GameState){
 const checkpoint=state.rewindCheckpoint;
 const previousIds=new Set(checkpoint?.transactions.map(t=>t.id));
 // The first undone purchase is the decision the player can change on replay.
 const purchase=checkpoint?[...state.transactions].reverse().find(t=>t.kind==='purchase'&&!previousIds.has(t.id)):undefined;
 const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD'});
 const priority={
  none:'Before buying again, cover food, rent, and utilities before optional purchases.',
  food_shortage:'Buy groceries before treats. Keep food money separate so your next purchase does not empty the fridge.',
  power_cut:'Pay utilities and reserve rent money before shopping. Keep the lights on before adding extras.',
  eviction:'Pay rent first when you replay the day. Do not use housing money for optional purchases.',
  exhaustion:'Choose food and rest before more shopping. Take care of your character instead of repeating the same spending pace.',
  bankruptcy:'Skip any purchase that would send your balance into debt. Cover essentials before considering extras.'
 }[state.ending.kind];
 let change='Make a different first choice: check what you need before buying what you want.';
 if(purchase){
  const category=CATEGORY_META[purchase.category].label.toLowerCase();
  change=purchase.category==='leisure'
   ?`Skip or reduce the ${money(purchase.amount)} ${category} purchase when you replay this day. Put needs before treats.`
   :`Reconsider the ${money(purchase.amount)} ${category} purchase. Cover what you actually need and choose a cheaper option where possible.`;
  if(purchase.category==='housing'||purchase.category==='utilities')change=`Keep the ${category} payment a priority. Before paying ${money(purchase.amount)} again, check the amount due and cut optional purchases instead.`;
 }
 const steps=[change,priority];
 if(checkpoint){
  const essentials=spendingForecast(checkpoint).essentialsRemaining;
  steps.push(`At the rewind point you have ${money(checkpoint.metrics.cashBalance)}. Set aside ${money(essentials)} for essential costs before choosing a replacement purchase.`);
 }else steps.push('Start your new run with essentials funded, then decide what you can afford for fun.');
 return {heading:checkpoint?'What to change when you rewind':'What to change in your next run',intro:checkpoint?`Go back to Day ${dayOfMonth(checkpoint.metrics.turn)} and try a different decision.`:'Take this lesson into a fresh start.',steps};
}
