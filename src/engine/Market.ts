import { REAL_STOCKS } from '../data/realStocks.ts';
const STEP_MS = 1000, BARS_PER_STEP = 5, STOCKS_PER_SESSION = 6;
const roundPrice = (n: number) => Math.round(n * 100) / 100;
const average = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
export interface Trade { seq: number; type: 'buy' | 'sell'; qty: number; price: number; t: number }
export interface StockInstrument { id: string; ticker: string; name: string; prices: number[]; cursor: number; price: number; sessionStart: number; history: { seq: number; price: number }[]; trades: Trade[] }
export interface Market { seq: number; stocks: StockInstrument[]; barCount: number }

function dealStocks() {
    const pool = [...REAL_STOCKS];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, STOCKS_PER_SESSION);
}
export function createMarket(): Market {
    const stocks = dealStocks().map(s => ({ id: s.id, ticker: s.ticker, name: s.name, prices: s.prices, cursor: 0, price: s.prices[0], sessionStart: s.prices[0], history: [{ seq: 0, price: s.prices[0] }], trades: [] as Trade[] }));
    return { seq: 0, stocks, barCount: Math.min(...stocks.map(s => s.prices.length)) };
}
export function marketInstrument(market: Market, id: string): StockInstrument | null { return market.stocks.find(s => s.id === id) ?? null; }
export function sessionDurationMs(market: Market): number { return Math.ceil(market.barCount / BARS_PER_STEP) * STEP_MS; }
export function marketFinished(market: Market): boolean { return market.stocks.every(s => s.cursor >= s.prices.length); }
export function stepMarket(market: Market): Market {
    const s = structuredClone(market);
    s.seq++;
    for (const stock of s.stocks) {
        const group = stock.prices.slice(stock.cursor, stock.cursor + BARS_PER_STEP);
        if (group.length) { stock.price = roundPrice(average(group)); stock.cursor += group.length; }
        stock.history.push({ seq: s.seq, price: stock.price });
    }
    return s;
}
export function holdingsValue(market: Market, holdings: Record<string, number>): number {
    return roundPrice(Object.entries(holdings || {}).reduce((sum, [id, qty]) => { const inst = marketInstrument(market, id); return sum + (inst ? inst.price * qty : 0); }, 0));
}
