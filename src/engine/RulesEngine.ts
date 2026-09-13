import {rewardVerifiedMissions,verifiedPurpose} from './Progression.ts';
import { categories, type GameState, type Profile, type BankTransaction, type CategoryKey } from './Types.ts';
import { CATEGORY_META, DEFAULT_PROFILE } from './Constants.ts';
import { DAYS_PER_MONTH,dayOfMonth,localDailyReview } from './DailyReview.ts';
import { INITIAL_LIFE, transactionScene } from './Life.ts';
import { INITIAL_INVESTING, growAccounts } from './Investing.ts';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n * 100) / 100;
export function careForHome(state:GameState,action:'rest'|'tidy'):GameState {
    if(state.isGameOver)return state;
    const last=action==='rest'?'lastRestTurn':'lastTidyTurn';
    if(state.life[last]===state.metrics.turn)return state;
    const s=structuredClone(state);s.life[last]=s.metrics.turn;
    if(action==='rest'){
        s.life.energy=clamp(s.life.energy+(s.life.foodStock>0?15:3));
        if(s.life.foodStock>=25)s.metrics.health=clamp(s.metrics.health+3);
        s.player.state='sleeping';s.player.targetPosition={x:8,y:2};
        s.life.lastEvent=s.life.foodStock>0?'An early night. Finally, a little energy back.':'I tried to sleep, but it is hard on an empty stomach.';
    } else {
        s.life.clutter=Math.max(0,s.life.clutter-2);s.life.stress=clamp(s.life.stress-5);
        s.player.state='working';s.player.targetPosition={x:6,y:9};s.life.lastEvent='A few boxes put away. A little more space to breathe. The bills still need a plan.';
    }
    return s;
}
export function createGame(profile: Profile = DEFAULT_PROFILE): GameState {
    const jar = (category: CategoryKey) => ({ category, allocatedAmount: profile.allocations[category], spentAmount: 0, rolloverAmount: 0, minViableSpend: CATEGORY_META[category].minimum });
    return { version: 3,investing:structuredClone(INITIAL_INVESTING),progression:{coins:0,claimed:[],owned:[],coinLog:[]},dialogue:[],ending:{phase:'none',kind:'none',reason:''}, reviews:[],command:{message:'',severity:'info',behavior:'calm',day:0}, life:{...INITIAL_LIFE}, profile, player: { ...profile, position: { x: 6, y: 6, z: 300 }, targetPosition: null, state: 'idle' }, metrics: { health: 100, happiness: 80, cashBalance: profile.income, debtBalance: 0, turn: 1, roomLevel: 1 }, jars: { food: jar('food'), housing: jar('housing'), transit: jar('transit'), leisure: jar('leisure'), utilities: jar('utilities'), savings: jar('savings') }, transactions: [], advisorLog: [{ timestamp: 0, severity: 'info', message: 'A fresh apartment. A fresh start. Give every dollar a place to call home.', actionablePlan: ['Cover your essentials first.', 'Put something aside for future you.'] }], isGameOver: false, housingDeficits: 0, savedTotal: 0, completedMonths: 0, mode: 'demo' };
}
export function applyTransactions(state: GameState, transactions: BankTransaction[], authoritativeBalance?: number, origin: 'manual'|'nessie'|'mock'='manual'): GameState {
    if (state.isGameOver)
        return state;
    const s = structuredClone(state);
    const seen = new Set(s.transactions.map(t => t.id));
    for (const t of transactions) {
        if (seen.has(t.id))
            continue;
        if(t.kind==='purchase' && (!s.rewindCheckpoint || localDailyReview(s,'preview').analysis.ending==='none')) {
            const {rewindCheckpoint, ...checkpoint}=structuredClone(s);
            s.rewindCheckpoint=checkpoint;
        }
        seen.add(t.id);
        s.transactions.unshift({...t,origin,purpose:origin!=='manual'?verifiedPurpose(t):undefined,gameDay:t.gameDay??s.metrics.turn});
        if (t.kind === 'income')
            s.metrics.cashBalance += t.amount;
        else {
            s.metrics.cashBalance -= t.amount;
            s.jars[t.category].spentAmount = round(s.jars[t.category].spentAmount + t.amount);
            if (t.kind === 'saving')
                s.savedTotal = round(s.savedTotal + t.amount);
            const jar = s.jars[t.category];
            const previousExcess = Math.max(0,jar.spentAmount-t.amount-jar.allocatedAmount-jar.rolloverAmount);
            const newExcess = Math.max(0,jar.spentAmount-jar.allocatedAmount-jar.rolloverAmount)-previousExcess;
            if(t.category==='food'){s.metrics.health=clamp(s.metrics.health+Math.min(4,t.amount*.02));s.life.foodStock=clamp(s.life.foodStock+t.amount*.4);s.life.energy=clamp(s.life.energy+Math.min(12,t.amount*.1));}
            if(t.category==='utilities'&&jar.spentAmount>=100){s.life.powerOn=true;s.metrics.happiness=clamp(s.metrics.happiness+Math.min(3,t.amount*.03));}
            if(t.category==='housing')s.metrics.happiness=clamp(s.metrics.happiness+Math.min(4,t.amount*.004));
            if(t.category==='leisure'){s.metrics.happiness=clamp(s.metrics.happiness+Math.min(8,t.amount*.05));s.life.clutter=Math.min(12,s.life.clutter+1);}
            if(t.category==='savings'&&s.metrics.cashBalance>=0)s.life.stress=clamp(s.life.stress-5);
            if(newExcess>0){const impact=Math.min(25,Math.ceil(newExcess/20));s.life.stress=clamp(s.life.stress+impact);s.life.energy=clamp(s.life.energy-impact/2);s.metrics.happiness=clamp(s.metrics.happiness-impact);if(t.category==='leisure')s.life.clutter=Math.min(12,s.life.clutter+2);}

            if (jar.spentAmount > jar.allocatedAmount + jar.rolloverAmount)
                s.advisorLog.unshift({ timestamp: s.metrics.turn, severity: 'warning', message: `${CATEGORY_META[t.category].label} is over budget by $${round(jar.spentAmount - jar.allocatedAmount - jar.rolloverAmount)}. Your next choice matters.`, actionablePlan: ['Pause optional spending in this category.', 'Rebalance next month before increasing spending.'] });
        }
        const scene=transactionScene(t);
        s.player.targetPosition=scene.target;
        s.player.state=scene.activity;
        s.life.lastEvent=scene.line;
        if(s.life.stress>=35)s.life.lastEvent='The shopping bags keep piling up. So does the worry about paying the bills.';
    }
    if (authoritativeBalance !== undefined)
        s.metrics.cashBalance = authoritativeBalance;
    s.metrics.cashBalance = round(s.metrics.cashBalance);
    s.metrics.debtBalance = Math.max(0, -s.metrics.cashBalance);
    s.metrics.roomLevel = 1 + (s.progression.owned.includes('house')?1:0);
    if (s.metrics.cashBalance < -1000) {
        s.isGameOver = true;
        s.player.state='dead';
        s.gameOverReason = 'Bankruptcy: your checking balance fell below −$1,000.';
    }
    return origin!=='manual'?rewardVerifiedMissions(s):s;
}

export function advanceTurn(state: GameState): GameState {
    if (state.isGameOver)
        return state;
    const s = structuredClone(state);
    s.metrics.turn++;
    s.investing.today=null;
    s.life.foodStock=clamp(s.life.foodStock-2.4);
    s.life.energy=clamp(s.life.energy+(s.life.foodStock>=25&&s.life.powerOn?1:-1.5));
    if(s.life.foodStock===0)s.metrics.health=clamp(s.metrics.health-2);
    s.life.stress=clamp(s.life.stress-0.5);
    if(s.life.stress<35&&dayOfMonth(s.metrics.turn)%7===0)s.life.clutter=Math.max(0,s.life.clutter-1);
    s.life.lastEvent=s.life.foodStock<25?'I opened the fridge again. Still nothing for dinner.':s.life.stress>=35?'I cannot stop thinking about those bills.':'A new day. A small chance to make life better.';
    s.player.state=s.life.energy<30?'sleeping':'idle';
    if(s.metrics.health<=0){s.isGameOver=true;s.player.state='dead';s.gameOverReason='Exhaustion: the fridge stayed empty for too long.';return s;}
    // One turn is a day. Settle a 30-day game month exactly once.
    if ((s.metrics.turn - 1) % DAYS_PER_MONTH !== 0)
        return s;
    s.investing.accounts=growAccounts(s.investing.accounts);
    const food = s.jars.food;
    s.metrics.health = clamp(s.metrics.health - 15 * Math.max(0, 1 - food.spentAmount / food.minViableSpend));
    const overdrafts = categories.filter(c => s.jars[c].spentAmount > s.jars[c].allocatedAmount + s.jars[c].rolloverAmount).length;
    s.metrics.happiness = clamp(s.metrics.happiness + (s.jars.leisure.allocatedAmount > 0 ? Math.min(2, s.jars.leisure.spentAmount / s.jars.leisure.allocatedAmount) * 10 : 0) - overdrafts * 20 - (s.jars.utilities.spentAmount < 100 ? 10 : 0));
    s.housingDeficits = s.jars.housing.spentAmount < s.jars.housing.minViableSpend ? s.housingDeficits + 1 : 0;
    s.life.powerOn=s.jars.utilities.spentAmount>=100;
    s.completedMonths++;
    if (s.metrics.health <= 0) {
        s.isGameOver = true;
        s.gameOverReason = 'Exhaustion: your food spending could not sustain your health.';
    }
    else if (s.housingDeficits >= 2) {
        s.isGameOver = true;
        s.gameOverReason = 'Eviction: rent was underfunded for two consecutive months.';
    }
    else if (s.metrics.happiness <= 0) {
        s.isGameOver = true;
        s.gameOverReason = 'Burnout: happiness reached zero.';
    }
    if (s.isGameOver) {
        s.player.state = 'dead';
        return s;
    }
    for (const c of categories) {
        const j = s.jars[c];
        j.rolloverAmount = round(Math.max(0, j.allocatedAmount + j.rolloverAmount - j.spentAmount));
        j.spentAmount = 0;
    }
    s.advisorLog.unshift({ timestamp: s.metrics.turn, severity: s.housingDeficits ? 'warning' : 'info', message: s.housingDeficits ? 'Rent is overdue. Fund housing this month to avoid eviction.' : `Month ${s.completedMonths} complete. Your unspent jar balances rolled over.`, actionablePlan: ['Start the new month with essentials.'] });
    return s.mode === 'demo' ? applyTransactions(s, [{ id: `salary-${s.completedMonths}`, payerId: 'demo', medium: 'balance', paymentDate: `Month ${s.completedMonths + 1}`, amount: s.profile.income, description: 'Monthly paycheck', category: 'savings', kind: 'income' }]) : s;
}
