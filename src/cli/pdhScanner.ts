import { getHistory } from "../services/fyers/getHistory.ts";

export type PdhTrade = {
    symbol: string;
    name: string;
    entryPrice: number;
    targetPrice: number;
    stopPrice: number;
    currentPrice: number;
    status: "ACTIVE" | "TP" | "SL" | "CLOSED_EOD";
    enteredAt: Date;
    dayHigh?: number;
    dayLow?: number;
    exitTime?: Date;
    exitPrice?: number;
    qty?: number;
    pnl?: number;
    rr?: number;
};

export const pdhTracker = new Map<string, PdhTrade>();
const pdhCache = new Map<string, number>();
const lastChecked = new Map<string, number>();
const RISK_PER_TRADE = 1000;

export async function processPdhSweep(stocks: any[], saveTrade: (t: any) => void) {
    const top20 = stocks.slice(0, 20);
    const currentMinute = new Date().getMinutes();

    for (const stock of top20) {
        if (pdhTracker.has(stock.symbol)) continue;

        // 1. Get Previous Day High
        let pdh = pdhCache.get(stock.symbol);
        if (!pdh) {
            try {
                const history = await getHistory({ symbol: stock.symbol, resolution: "D", days: 4 });
                if (history && history.candles && history.candles.length >= 2) {
                    const prevCandle = history.candles[history.candles.length - 2];
                    pdh = prevCandle[2]; // high
                    pdhCache.set(stock.symbol, pdh);
                }
            } catch (e) {
                continue;
            }
        }

        if (!pdh) continue;

        // 2. Check if today's high sweeps PDH
        if (stock.high >= pdh) {
            const lastCheckMinute = lastChecked.get(stock.symbol) || -1;
            if (currentMinute % 3 !== 0 && lastCheckMinute !== -1) continue;
            if (currentMinute === lastCheckMinute) continue;

            try {
                const intraday = await getHistory({ symbol: stock.symbol, resolution: "3", days: 1 });
                lastChecked.set(stock.symbol, currentMinute);

                if (intraday && intraday.candles && intraday.candles.length >= 3) {
                    const candles = intraday.candles;
                    const lastClosed = candles[candles.length - 2];
                    const prevToLast = candles[candles.length - 3];

                    if (!lastClosed || !prevToLast) continue;

                    const [prevTime, prevOpen, prevHigh, prevLow, prevClose] = prevToLast;
                    const [lastTime, lastOpen, lastHigh, lastLow, lastClose] = lastClosed;

                    const isInside = (lastHigh <= prevHigh) && (lastLow >= prevLow);
                    if (isInside) continue;

                    const isRed = lastClose < lastOpen;
                    if (!isRed) continue;

                    const isAbovePdh = lastClose > pdh;
                    if (!isAbovePdh) continue;

                    const entryPrice = lastClose; // Short Entry
                    const stopPrice = lastHigh; // SL above red candle wick
                    const riskAmount = stopPrice - entryPrice;
                    
                    if (riskAmount <= 0) continue;

                    const qty = Math.floor(RISK_PER_TRADE / riskAmount);
                    const targetPrice = entryPrice - (riskAmount * 4); // 1:4 RR

                    const newTrade: PdhTrade = {
                        symbol: stock.symbol,
                        name: stock.name, 
                        entryPrice,
                        targetPrice,
                        stopPrice,
                        currentPrice: stock.ltp,
                        status: "ACTIVE",
                        enteredAt: new Date(),
                        dayHigh: stock.high,
                        dayLow: stock.low,
                        qty: qty,
                        pnl: 0,
                        rr: 0
                    };

                    pdhTracker.set(stock.symbol, newTrade);
                    
                    saveTrade({
                        ...newTrade,
                        fib618: pdh
                    });
                }
            } catch (e) {
                continue;
            }
        }
    }
}

export function updatePdhTrades(stocks: any[], saveTrade: (t: any) => void, isEod: boolean = false) {
    for (const stock of stocks) {
        const trade = pdhTracker.get(stock.symbol);
        if (!trade) continue;

        trade.currentPrice = stock.ltp;

        if (trade.status !== "ACTIVE") continue;

        // PDH is a SHORT trade
        const diff = trade.entryPrice - trade.currentPrice;
        trade.pnl = diff * (trade.qty || 0);
        trade.rr = diff / (trade.stopPrice - trade.entryPrice);

        if (isEod) {
            trade.status = "CLOSED_EOD";
            trade.exitTime = new Date();
            trade.exitPrice = stock.ltp;
            saveTrade({ ...trade, fib618: pdhCache.get(stock.symbol) });
        } else if (stock.ltp <= trade.targetPrice) {
            trade.status = "TP";
            trade.exitTime = new Date();
            trade.exitPrice = stock.ltp;
            saveTrade({ ...trade, fib618: pdhCache.get(stock.symbol) });
        } else if (stock.ltp >= trade.stopPrice) {
            trade.status = "SL";
            trade.exitTime = new Date();
            trade.exitPrice = stock.ltp;
            saveTrade({ ...trade, fib618: pdhCache.get(stock.symbol) });
        }
    }
}
