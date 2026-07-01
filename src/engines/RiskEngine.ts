import { DB } from "../core/db.ts";
import { getQuotes } from "../core/FyersAPI.ts";
import { EventBus, Events } from "../core/EventBus.ts";

const RISK_POLL_INTERVAL_MS = 3000; // 3 seconds (realtime tick emulation)

export class RiskEngine {
    private isRunning = false;

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🛡️  Risk Management Engine started.");
        this.loop();
    }

    public stop() {
        this.isRunning = false;
        console.log("🛑 Risk Management Engine stopped.");
    }

    private async loop() {
        while (this.isRunning) {
            try {
                await this.processActiveTrades();
            } catch (err) {
                console.error("Risk Engine Error:", err);
            }
            await new Promise((r) => setTimeout(r, RISK_POLL_INTERVAL_MS));
        }
    }

    private async processActiveTrades() {
        const activeTrades = DB.getActiveTrades.all() as any[];
        if (activeTrades.length === 0) return;

        const now = new Date();
        const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // IST
        const isEod = currentHour >= 15.25; // 3:15 PM

        // Batch fetch live prices
        const symbols = activeTrades.map((t) => t.symbol);
        const uniqueSymbols = [...new Set(symbols)];
        const quotes = await this.batchFetchQuotes(uniqueSymbols);
        
        for (const trade of activeTrades) {
            const quote = quotes.get(trade.symbol);
            if (!quote) continue;

            const ltp = quote.lp;
            let diff = 0;
            let riskAmount = 0;

            if (trade.direction === 'LONG') {
                diff = ltp - trade.entryPrice;
                riskAmount = trade.entryPrice - trade.stopPrice;
            } else {
                diff = trade.entryPrice - ltp;
                riskAmount = trade.stopPrice - trade.entryPrice;
            }

            const currentPnl = diff * trade.qty;
            const currentRr = riskAmount > 0 ? diff / riskAmount : 0;

            if (isEod) {
                // End of day auto close
                DB.closeTrade.run({
                    status: 'CLOSED_EOD',
                    exitTime: new Date().toISOString(),
                    exitPrice: ltp,
                    pnl: currentPnl,
                    rr: currentRr,
                    symbol: trade.symbol
                });
                console.log(`⏱️ EOD Reached. Force closing ${trade.symbol} at ₹${ltp} | PnL: ₹${currentPnl.toFixed(2)}`);
                EventBus.emit(Events.TRADE_CLOSED, { ...trade, exitPrice: ltp, status: 'CLOSED_EOD' });
            } 
            else if (ltp >= trade.targetPrice && trade.direction === 'LONG' || ltp <= trade.targetPrice && trade.direction === 'SHORT') {
                // Take Profit hit
                DB.closeTrade.run({
                    status: 'TP',
                    exitTime: new Date().toISOString(),
                    exitPrice: ltp,
                    pnl: currentPnl,
                    rr: currentRr,
                    symbol: trade.symbol
                });
                console.log(`✅ TP Hit for ${trade.symbol} at ₹${ltp} | PnL: ₹${currentPnl.toFixed(2)}`);
                EventBus.emit(Events.TRADE_CLOSED, { ...trade, exitPrice: ltp, status: 'TP' });
            } 
            else if (ltp <= trade.stopPrice && trade.direction === 'LONG' || ltp >= trade.stopPrice && trade.direction === 'SHORT') {
                // Stop Loss hit
                DB.closeTrade.run({
                    status: 'SL',
                    exitTime: new Date().toISOString(),
                    exitPrice: ltp,
                    pnl: currentPnl,
                    rr: currentRr,
                    symbol: trade.symbol
                });
                console.log(`❌ SL Hit for ${trade.symbol} at ₹${ltp} | PnL: ₹${currentPnl.toFixed(2)}`);
                EventBus.emit(Events.TRADE_CLOSED, { ...trade, exitPrice: ltp, status: 'SL' });
            } 
            else {
                // Still active, just update live PnL and push TICK
                DB.updateTradeLive.run({
                    pnl: currentPnl,
                    rr: currentRr,
                    symbol: trade.symbol
                });
                
                EventBus.emit("TRADE_TICK", {
                    symbol: trade.symbol,
                    strategy: trade.strategy,
                    direction: trade.direction,
                    ltp: ltp,
                    pnl: currentPnl
                });
            }
        }
    }

    private async batchFetchQuotes(symbols: string[]): Promise<Map<string, any>> {
        const quoteMap = new Map<string, any>();
        try {
            for (let i = 0; i < symbols.length; i += 50) {
                const chunk = symbols.slice(i, i + 50);
                const res = await getQuotes(chunk);
                if (res && res.d) {
                    res.d.forEach((item: any) => {
                        if (item.v && item.v.symbol) {
                            quoteMap.set(item.v.symbol, item.v);
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Risk Engine failed to fetch quotes:", e);
        }
        return quoteMap;
    }
}
