import { z } from 'zod';
import {dailyCommentary,spendingJudgment} from './ReviewWriting.ts';
import type { GameState } from './Types.ts';
import {appendDialogue,beginEnding} from './Progression.ts';
export const DAYS_PER_MONTH=30;
export const dayOfMonth=(turn:number)=>(turn-1)%DAYS_PER_MONTH+1;
export const monthOfRun=(turn:number)=>Math.floor((turn-1)/DAYS_PER_MONTH)+1;
export const analysisSchema=z.object({feedback:z.enum(['standard','encouragement']).default('standard'),isWarning:z.boolean(),riskRating:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),commentary:z.string().min(1).max(160),reason:z.string().max(1500),recoverySteps:z.array(z.string().max(400)).min(1).max(4),behavior:z.enum(['calm','worried','restless','tired']),ending:z.enum(['none','food_shortage','power_cut','eviction','exhaustion']).default('none'),failureConfidence:z.number().min(0).max(1).default(0)});
export type DailyAnalysis=z.infer<typeof analysisSchema>;
export const forecastSchema=z.object({day:z.number().int(),daysRemaining:z.number().int(),todaySpent:z.number(),variableSpent:z.number(),essentialsRemaining:z.number(),projectedBalance:z.number(),safeDailySpend:z.number(),riskReasons:z.array(z.string()),threats:z.array(z.object({category:z.enum(['food','housing','utilities','leisure']),needed:z.number(),projectedAvailable:z.number(),shortfall:z.number()})).default([]),runoutDay:z.number().nullable().default(null)});
export const dailyReviewSchema=z.object({assessedDay:z.number().int().positive(),kind:z.enum(['preview','close']),source:z.enum(['gemini','fallback']),providerNotice:z.string().optional(),analysis:analysisSchema.extend({commentary:z.string().min(1).max(1500)}),forecast:forecastSchema,transactionIds:z.array(z.string())});
export type DailyReview=z.infer<typeof dailyReviewSchema>;
export const commandSchema=z.object({message:z.string(),severity:z.enum(['info','warning','critical']),behavior:z.enum(['calm','worried','restless','tired']),day:z.number().int().min(0)});
export function spendingForecast(state:GameState):z.infer<typeof forecastSchema>{
 const day=dayOfMonth(state.metrics.turn),daysRemaining=DAYS_PER_MONTH-day;
 const today=state.transactions.filter(t=>t.gameDay===state.metrics.turn);
 const todaySpent=today.filter(t=>t.kind==='purchase').reduce((n,t)=>n+t.amount,0);
 const variableSpent=state.jars.food.spentAmount+state.jars.transit.spentAmount+state.jars.leisure.spentAmount;
 const fixedRemaining=Math.max(0,Math.max(1000,state.jars.housing.allocatedAmount)-state.jars.housing.spentAmount)+Math.max(0,Math.max(100,state.jars.utilities.allocatedAmount)-state.jars.utilities.spentAmount);
 const foodRemaining=Math.max(0,240-state.jars.food.spentAmount),transitRemaining=Math.max(0,80-state.jars.transit.spentAmount);
 const essentialsRemaining=fixedRemaining+foodRemaining+transitRemaining;
 // Smooth the first week so one grocery shop is not extrapolated as a daily habit.
 const expectedVariable=variableSpent/Math.max(7,day)*daysRemaining;
 const projectedBalance=Math.round((state.metrics.cashBalance-fixedRemaining-Math.max(expectedVariable,foodRemaining+transitRemaining))*100)/100;
 const safeDailySpend=Math.max(0,(state.metrics.cashBalance-essentialsRemaining)/Math.max(1,daysRemaining));
 const riskReasons:string[]=[];
 if(state.metrics.cashBalance<essentialsRemaining)riskReasons.push('Current cash no longer covers the remaining essential bills.');
 if(projectedBalance<0)riskReasons.push('Continuing this spending pace could leave a shortfall before the next paycheck.');
 const leisure=state.jars.leisure;
 if(day<15&&leisure.spentAmount>0&&leisure.spentAmount>=.75*(leisure.allocatedAmount+leisure.rolloverAmount))riskReasons.push('Most of the leisure budget is already used before the middle of the month.');
 for(const [c,jar] of Object.entries(state.jars))if(jar.spentAmount>jar.allocatedAmount+jar.rolloverAmount)riskReasons.push(`${c} spending has passed its monthly plan.`);
 const optionalPace=state.jars.leisure.spentAmount/Math.max(7,day);
 let remaining=Math.max(0,state.metrics.cashBalance-optionalPace*daysRemaining);
 const needs=[{category:'food' as const,needed:foodRemaining},{category:'housing' as const,needed:Math.max(0,Math.max(1000,state.jars.housing.allocatedAmount)-state.jars.housing.spentAmount)},{category:'utilities' as const,needed:Math.max(0,100-state.jars.utilities.spentAmount)},{category:'leisure' as const,needed:Math.max(0,state.jars.leisure.allocatedAmount-state.jars.leisure.spentAmount)}];
 const threats=needs.flatMap(n=>{const available=Math.min(remaining,n.needed);remaining=Math.max(0,remaining-n.needed);return available<n.needed?[{...n,projectedAvailable:Math.round(available*100)/100,shortfall:Math.round((n.needed-available)*100)/100}]:[];});
 const pace=variableSpent/Math.max(7,day),runoutDay=pace>0?Math.min(31,day+Math.floor(Math.max(0,state.metrics.cashBalance-fixedRemaining)/pace)):null;
 return {threats,runoutDay,day,daysRemaining,todaySpent:Math.round(todaySpent*100)/100,variableSpent,essentialsRemaining,projectedBalance,safeDailySpend:Math.round(safeDailySpend*100)/100,riskReasons};
}
export function progressSinceWarning(state:GameState,forecast=spendingForecast(state)):string[]{
 const previous=state.reviews.find(r=>r.kind==='close'&&r.analysis.isWarning&&r.assessedDay<state.metrics.turn);
 // Older saves have reviews but no stored coaching baseline. Only reward them
 // when cash covers remaining essentials until a new baseline is recorded.
 const baseline=state.coachingBaseline??(previous?{review:previous,cashBalance:previous.forecast.essentialsRemaining,optionalSpent:state.transactions.filter(t=>t.gameDay===previous.assessedDay&&t.kind==='purchase'&&t.category==='leisure').reduce((sum,t)=>sum+t.amount,0)}:undefined);
 if(!baseline||monthOfRun(baseline.review.assessedDay)!==monthOfRun(state.metrics.turn))return [];
 const today=state.transactions.filter(t=>t.gameDay===state.metrics.turn&&t.kind==='purchase');
 const optional=today.filter(t=>t.category==='leisure').reduce((sum,t)=>sum+t.amount,0);
 const gap=Math.max(0,forecast.essentialsRemaining-state.metrics.cashBalance);
 // New discretionary spending or an actual insolvency cannot earn reassurance.
 if(optional>0||state.metrics.cashBalance<0||state.metrics.health<=0)return [];
 const covered=today.some(t=>['housing','utilities','food','transit'].includes(t.category));
 // Keep unresolved gaps visible in the explanation; reward the changed action.
 if(gap>Math.max(0,baseline.review.forecast.essentialsRemaining-baseline.cashBalance)+.01||(gap>0&&!covered))return [];
 if(covered)return ['covered essentials'];
 if(baseline.optionalSpent>0)return ['paused optional spending'];
 return [];
}
export function localDailyReview(state:GameState,kind:'preview'|'close'):DailyReview{
 const forecast=spendingForecast(state),warning=forecast.riskReasons.length>0;
 const analysis:DailyAnalysis={feedback:'standard',isWarning:warning,riskRating:state.metrics.cashBalance<forecast.essentialsRemaining?'HIGH':warning?'MEDIUM':'LOW',commentary:warning?'OMG, yesterday I spoiled my shopping bags. Now rent wants a word.':'Yesterday I kept my wallet out of trouble. Character development!',reason:warning?forecast.riskReasons.join(' '):'Your current spending pace leaves room for essentials before the next paycheck.',recoverySteps:warning?['Pause optional purchases and protect money for rent, food, and utilities.','Check the budget notebook before your next treat.']:['Keep essential bill money reserved.'],behavior:warning?'worried':'calm',ending:'none',failureConfidence:0};
 const serious=forecast.daysRemaining>0&&forecast.threats.length>0&&(forecast.threats.some(t=>t.category==='leisure')||state.metrics.cashBalance<forecast.essentialsRemaining||forecast.projectedBalance<-state.profile.income*.25||dayOfMonth(state.metrics.turn)<=7&&state.metrics.cashBalance<=state.profile.income*.5&&state.jars.leisure.spentAmount>0);
 if(serious){const threat=forecast.threats[0];analysis.ending=threat.category==='food'?'food_shortage':threat.category==='leisure'?'exhaustion':'power_cut';analysis.riskRating='CRITICAL';analysis.isWarning=true;analysis.failureConfidence=.95;analysis.behavior=threat.category==='food'?'tired':'worried';analysis.commentary=threat.category==='food'?'OMG, yesterday I spent my future dinners. My fridge is now a museum.':threat.category==='leisure'?'OMG, yesterday I spent my breathing room. Future me is running on stress.':'OMG, yesterday I spent the bill money. Future me is sitting in the dark.';analysis.reason=`At this spending pace, ${threat.category} is projected to be $${threat.shortfall.toFixed(2)} short before month end. This ending previews that future.`;}
 const progress=progressSinceWarning(state,forecast);
 if(progress.length){
  analysis.feedback='encouragement';analysis.isWarning=false;analysis.behavior='calm';analysis.ending='none';analysis.failureConfidence=0;
  analysis.commentary=progress.includes('covered essentials')?"You covered essentials today. You're doing great; keep going, one careful choice at a time.":"You held back on extras. I know it's hard, but you're doing great. Keep going!";
  analysis.reason=`You followed the plan: ${progress.join(' and ')}. ${forecast.riskReasons.length?'There is still work to do: '+forecast.riskReasons.join(' '):'Your remaining essentials are covered by available cash.'}`;
  analysis.recoverySteps=['Keep optional spending paused and reserve cash for remaining essentials.','Take it one day at a time; check the forecast before your next purchase.'];
 }
 analysis.commentary=dailyCommentary(state,analysis,forecast);
 analysis.reason=`${spendingJudgment(state,analysis)} Day ${forecast.day}: ${forecast.daysRemaining} days remain, with $${state.metrics.cashBalance.toFixed(2)} available. ${analysis.reason}`;
 return {assessedDay:state.metrics.turn,kind,source:'fallback'  ,analysis,forecast,transactionIds:state.transactions.filter(t=>t.gameDay===state.metrics.turn).map(t=>t.id)};
}
export function applyDailyReview(state:GameState,review:DailyReview):GameState{
 if(review.kind!=='close')return state;
 // Responses cannot write into a later day/run, nor settle one day twice.
 if(review.assessedDay!==state.metrics.turn&&(review.kind!=='close'||review.assessedDay!==state.metrics.turn-1))return state;
 if(review.kind==='close'&&state.reviews.some(r=>r.kind==='close'&&r.assessedDay===review.assessedDay))return state;
 let s=structuredClone(state);
 s.reviews=[review,...s.reviews.filter(r=>r.kind!==review.kind||r.assessedDay!==review.assessedDay)];
 const a=review.analysis;
 if(a.isWarning)s.coachingBaseline={review,cashBalance:s.metrics.cashBalance,optionalSpent:s.transactions.filter(t=>t.gameDay===review.assessedDay&&t.kind==='purchase'&&t.category==='leisure').reduce((sum,t)=>sum+t.amount,0)};
 s.command={message:a.commentary,severity:a.isWarning?(a.riskRating==='CRITICAL'?'critical':'warning'):'info',behavior:a.behavior,day:review.assessedDay};
 s.advisorLog.unshift({timestamp:review.assessedDay,severity:s.command.severity,message:a.commentary,actionablePlan:a.recoverySteps});
 s=appendDialogue(s,a.commentary,a.isWarning?'warning':'info',`review-${review.assessedDay}`);
 // One fine per closed day with actual discretionary spending. Coins are game currency, not bank cash.
 const optionalSpent=s.transactions.some(t=>t.gameDay===review.assessedDay&&t.kind==='purchase'&&t.category==='leisure'&&!t.purpose);
 if(a.isWarning&&optionalSpent){const fine=a.riskRating==='CRITICAL'?20:a.riskRating==='HIGH'?10:5;s.progression.coins-=fine;s.progression.coinLog.unshift({id:`fine-${review.assessedDay}`,day:review.assessedDay,amount:-fine,reason:'Risky discretionary spending'});}
 const confirmed=a.ending!=='none'&&a.failureConfidence>=.9&&a.riskRating==='CRITICAL'&&(review.forecast.projectedBalance<0||review.forecast.threats.some(t=>t.category==='leisure'))&&(review.forecast.threats.length>0||state.metrics.cashBalance<review.forecast.essentialsRemaining)&&review.forecast.daysRemaining>0;
 if(confirmed&&!s.isGameOver)s=beginEnding(s,a.ending,`Forecast ending: ${a.reason}`);
 // AI selects only a bounded animation command. It cannot move money or cause arbitrary stat penalties.
 if(!s.isGameOver){s.player.targetPosition=a.behavior==='tired'?{x:8,y:2}:a.isWarning?{x:8,y:2}:{x:5,y:4};s.player.state=a.behavior==='tired'?'sleeping':a.isWarning?'worried':'idle';}
 return s;
}
export function remainderPlan(state:GameState){
 const review=state.reviews.find(r=>r.kind==='close');const days=review?.forecast.daysRemaining??Math.max(0,30-dayOfMonth(state.metrics.turn));
 const cash=Math.max(0,state.metrics.cashBalance),essential=review?.forecast.essentialsRemaining??spendingForecast(state).essentialsRemaining;
 const daily=Math.max(0,cash-essential)/Math.max(1,days);
 return {days,cash,essential,shortfall:Math.max(0,essential-cash),daily:Math.floor(daily*100)/100,steps:review?.analysis.recoverySteps??['Pause optional spending.','Reserve remaining cash for food and essential bills.']};
}
