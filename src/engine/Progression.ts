import {z} from 'zod';
import type {GameState,BankTransaction} from './Types.ts';
export const progressionSchema=z.object({coins:z.number().int().min(-1000000).default(0),claimed:z.array(z.string()).default([]),owned:z.array(z.enum(['plant','lamp','rug','bookshelf','house'])).default([]),coinLog:z.array(z.object({id:z.string(),day:z.number().int(),amount:z.number().int(),reason:z.string()})).default([])}).default({coins:0,claimed:[],owned:[],coinLog:[]});
export const dialogueSchema=z.object({id:z.string(),day:z.number().int(),message:z.string().max(1500),kind:z.enum(['action','warning','reward','ending','info'])});
export const endingSchema=z.object({phase:z.enum(['none','playing','complete']),kind:z.enum(['none','food_shortage','power_cut','eviction','exhaustion','bankruptcy']),reason:z.string()}).default({phase:'none',kind:'none',reason:''});
export const MISSIONS=[{id:'saving',title:'Future-you fund',detail:'Transfer $150 to savings.',target:150,reward:60},{id:'gym',title:'Move your body',detail:'Spend $25 at a gym or fitness studio.',target:25,reward:40},{id:'health',title:'Look after yourself',detail:'Spend $30 at a pharmacy or health provider.',target:30,reward:40}] as const;
export const SHOP=[{id:'plant',name:'A leafy roommate',cost:30,description:'A new plant for your room.'},{id:'lamp',name:'Reading lamp',cost:45,description:'A little light beside your bed.'},{id:'rug',name:'A softer landing',cost:60,description:'Replace the rug with a warm woven one.'},{id:'bookshelf',name:'Bookshelf',cost:80,description:'Make room for your next chapter.'},{id:'house',name:'Upgrade the apartment',cost:120,description:'A new wall finish and a higher home level.'}] as const;
export function missionProgress(s:GameState,id:typeof MISSIONS[number]['id']){
 const month=Math.floor((s.metrics.turn-1)/30);
 return s.transactions.filter(t=>(t.origin==='nessie'||t.origin==='mock')&&Math.floor(((t.gameDay||1)-1)/30)===month&&t.purpose===id).reduce((n,t)=>n+t.amount,0);
}
export function appendDialogue(s:GameState,message:string,kind:'action'|'warning'|'reward'|'ending'|'info'='action',id?:string):GameState{
 if(!message||s.dialogue.some(d=>id?d.id===id:d.day===s.metrics.turn&&d.message===message))return s;
 return {...s,dialogue:[{id:id||`line-${s.metrics.turn}-${s.dialogue.length}`,day:s.metrics.turn,message:message.slice(0,1500),kind},...s.dialogue]};
}
export function rewardVerifiedMissions(state:GameState):GameState{
 let s=structuredClone(state);const month=Math.floor((s.metrics.turn-1)/30)+1;
 for(const mission of MISSIONS){const key=`mission-${month}-${mission.id}`;
  if(s.progression.claimed.includes(key)||missionProgress(s,mission.id)<mission.target)continue;
  s.progression.claimed.push(key);s.progression.coins+=mission.reward;
  s.progression.coinLog.unshift({id:key,day:s.metrics.turn,amount:mission.reward,reason:mission.title});
  if(mission.id==='gym'){s.metrics.health=Math.min(100,s.metrics.health+5);s.life.energy=Math.min(100,s.life.energy+5);}
  if(mission.id==='health')s.metrics.health=Math.min(100,s.metrics.health+8);
  const message=`${mission.title} complete! +${mission.reward} coins. Future me says thanks.`;
  s=appendDialogue(s,message,'reward',key);s.command={message,severity:'info',behavior:'calm',day:s.metrics.turn};
 }
 return s;
}
export function buyFurniture(state:GameState,id:typeof SHOP[number]['id']):GameState{
 const item=SHOP.find(i=>i.id===id);if(!item||state.isGameOver||state.progression.owned.includes(id)||state.progression.coins<item.cost)return state;
 const s=structuredClone(state);s.progression.coins-=item.cost;s.progression.owned.push(id);s.progression.coinLog.unshift({id:`shop-${id}`,day:s.metrics.turn,amount:-item.cost,reason:item.name});
 if(id==='house')s.metrics.roomLevel++;
 return appendDialogue(s,`${item.name}. Bought with good habits, not rent money.`,'reward',`shop-${id}`);
}
export function beginEnding(state:GameState,kind:GameState['ending']['kind'],reason:string):GameState{
 if(state.ending.phase!=='none')return state;
 const s={...state,isGameOver:true,gameOverReason:reason,ending:{phase:'playing' as const,kind,reason}};
 return appendDialogue(s,reason,'ending',`ending-${s.metrics.turn}`);
}
export function finishEnding(state:GameState):GameState{if(state.ending.phase!=='playing')return state;return {...state,ending:{...state.ending,phase:'complete'},player:{...state.player,state:'dead'}};}
export function verifiedPurpose(t:Pick<BankTransaction,'kind'|'description'>):'saving'|'gym'|'health'|undefined{
 if(t.kind==='saving')return 'saving';
 if(t.kind!=='purchase')return undefined;
 if(/\bgym\b|fitness|yoga|pilates|health club/i.test(t.description))return 'gym';
 if(/pharmacy|clinic|hospital|dentist|medical|healthcare|health care|prescription|\bcvs\b|walgreens/i.test(t.description))return 'health';
 return undefined;
}
