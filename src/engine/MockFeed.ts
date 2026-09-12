import {z} from 'zod';
import {transactionSchema,type GameState} from './Types.ts';
import {applyTransactions} from './RulesEngine.ts';
import {dayOfMonth,monthOfRun} from './DailyReview.ts';

export const mockFeedSchema=z.object({
 name:z.string(),
 days:z.array(z.object({day:z.number().int().min(1).max(30),transactions:z.array(transactionSchema)})).length(30)
}).refine(feed=>feed.days.every((day,index)=>day.day===index+1),'Mock days must be ordered 1 through 30')
 .refine(feed=>{const ids=feed.days.flatMap(day=>day.transactions.map(t=>t.id));return new Set(ids).size===ids.length;},'Transaction IDs must be unique');
export type MockFeed=z.infer<typeof mockFeedSchema>;

export function transactionsUpdatedToday(state:GameState):boolean{
 return state.transactionUpdateTurns?.includes(state.metrics.turn)??false;
}

export function importMockDay(state:GameState,feed:MockFeed,expectedTurn=state.metrics.turn):GameState{
 const day=dayOfMonth(state.metrics.turn),month=monthOfRun(state.metrics.turn);
 if(state.isGameOver||expectedTurn!==state.metrics.turn||transactionsUpdatedToday(state))return state;
 const batch=feed.days[day-1];
 if(!batch||batch.day!==day)throw new Error('Transactions for this day are unavailable.');
 // Keep Month 1 IDs compatible with existing saves; later months are independent.
 const transactions=batch.transactions.map(t=>({...t,id:month===1?t.id:`${t.id}-month-${month}`,paymentDate:`Month ${month}, Day ${day}`,gameDay:state.metrics.turn}));
 const next=applyTransactions({...state,mode:'demo'},transactions,undefined,'mock');
 return {...next,transactionUpdateTurns:[...(state.transactionUpdateTurns??[]),state.metrics.turn]};
}
