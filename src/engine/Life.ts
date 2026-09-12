import type { GameState, BankTransaction } from './Types.ts';
export const INITIAL_LIFE = { foodStock:65, energy:85, stress:0, clutter:0, powerOn:true, lastRestTurn:0,lastTidyTurn:0,lastEvent:'New keys. An empty room. A life waiting to happen.' };
export function roomConditions(game:GameState){
 const warnings:string[]=[];
 if(game.life.foodStock<25)warnings.push('The fridge is almost empty. A grocery run will help.');
 if(!game.life.powerOn)warnings.push('The power is off. Pay the utility bill to bring the lights back.');
 if(game.housingDeficits)warnings.push('A rent notice is on your bed. One more missed month means eviction.');
 if(game.life.stress>=15)warnings.push('Spending stress is following you home. Pause optional purchases.');
 if(game.life.energy<30)warnings.push('You are running on empty. Eat, keep the lights on, and rest.');
 return warnings;
}
export function transactionScene(t:BankTransaction){
 if(t.kind==='income')return {target:{x:3,y:7},activity:'working' as const,line:'Payday. All those hours at the desk paid off.'};
 const scenes={food:{target:{x:2,y:2},activity:'eating' as const,line:'Groceries are home. Time to make something good.'},housing:{target:{x:8,y:2},activity:'sleeping' as const,line:'Rent paid. Tonight, I can sleep a little easier.'},utilities:{target:{x:2,y:4},activity:'working' as const,line:'Lights on. Kettle on. This feels like home again.'},leisure:{target:{x:6,y:9},activity:'partying' as const,line:'A little fun. A little escape from the everyday.'},transit:{target:{x:7,y:11},activity:'walking' as const,line:'Keys, wallet, shoes. Heading out into the world.'},savings:{target:{x:7,y:9},activity:'working' as const,line:'Something set aside for the life I want to build.'}};
 return scenes[t.category];
}
