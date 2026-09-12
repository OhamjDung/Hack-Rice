import {categories,type GameState} from './Types.ts';
import {CATEGORY_META} from './Constants.ts';
import {monthOfRun,DAYS_PER_MONTH} from './DailyReview.ts';

export function monthlySummary(state:GameState){
 const month=monthOfRun(state.metrics.turn),firstDay=(month-1)*DAYS_PER_MONTH+1;
 const transactions=state.transactions.filter(t=>t.gameDay!==undefined&&t.gameDay>=firstDay&&t.gameDay<=state.metrics.turn);
 const rows=categories.map(category=>({category,label:CATEGORY_META[category].label,budget:state.jars[category].allocatedAmount+state.jars[category].rolloverAmount,spent:state.jars[category].spentAmount}));
 const spent=rows.filter(r=>r.category!=='savings').reduce((sum,r)=>sum+r.spent,0);
 const saved=transactions.filter(t=>t.kind==='saving').reduce((sum,t)=>sum+t.amount,0);
 const over=rows.filter(r=>r.spent>r.budget);
 const essentials=categories.filter(c=>state.jars[c].spentAmount<CATEGORY_META[c].minimum);
 const reviews=state.reviews.filter(r=>r.kind==='close'&&r.assessedDay>=firstDay&&r.assessedDay<=state.metrics.turn);
 const wins=[...(saved>0?['You set money aside for your future.']:[]),...(essentials.length===0?['You covered the minimum spending for all essentials.']:[]),...(reviews.some(r=>r.analysis.feedback==='encouragement')?['You followed advice and made more careful choices.']:[])];
 const steps=[...(essentials.length?[`Prioritize ${essentials.map(c=>CATEGORY_META[c].label.toLowerCase()).join(', ')} next month.`]:['Keep essential bill money reserved before buying extras.']),...(over.length?[`Revisit ${over.map(r=>r.label.toLowerCase()).join(', ')}: spending exceeded the plan.`]:['Keep checking your plan before each purchase.']),...(state.life.foodStock<25?['Restock the fridge; your supplies are running low.']:[])];
 return {month,spent,saved,cash:state.metrics.cashBalance,rows,wins,steps};
}
