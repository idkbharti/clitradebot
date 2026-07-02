import { DB } from "../core/db.ts";
import { initDataSocket, subscribeToSymbol, unsubscribeFromSymbol } from "../core/FyersAPI.ts";
import { EventBus, Events } from "../core/EventBus.ts";

export class RiskEngine {
    private isRunning = false;

    constructor() {
        this.setupListeners();
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🛡️  Risk Management Engine started with Live WebSockets.");

        // Initialize the websocket and bind the tick handler
        initDataSocket(this.handleTick.bind(this));

        // Subscribe to all currently active trades
        const activeTrades = DB.getActiveTrades.all() as any[];
        activeTrades.forEach(t => subscribeToSymbol(t.symbol));
    }

    public stop() {
        this.isRunning = false;
        console.log("🛑 Risk Management Engine stopped.");
    }

    private setupListeners() {
        EventBus.on(Events.TRADE_EXECUTED, (trade: any) => {
            if (this.isRunning) {
                subscribeToSymbol(trade.symbol);
            }
        });

        EventBus.on(Events.TRADE_CLOSED, (trade: any) => {
            if (this.isRunning) {
                // Check if any OTHER active trade still uses this symbol before unsubscribing
                const activeTrades = DB.getActiveTrades.all() as any[];
                const stillNeeded = activeTrades.some(t => t.symbol === trade.symbol && t.status === 'ACTIVE');
                if (!stillNeeded) {
                    unsubscribeFromSymbol(trade.symbol);
                }
            }
        });
    }

    private handleTick(msg: any) {
        if (!this.isRunning) return;

        // Fyers websocket data structure parsing
        let ticks: any[] = [];
        if (Array.isArray(msg)) {
            ticks = msg;
        } else if (msg && Array.isArray(msg.d)) {
            ticks = msg.d;
        } else if (msg && typeof msg === 'object') {
            ticks = [msg];
        }

        if (ticks.length === 0) return;

        const activeTrades = DB.getActiveTrades.all() as any[];
        if (activeTrades.length === 0) return;

        const now = new Date();
        const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // IST
        const isEod = currentHour >= 15.25; // 3:15 PM

        for (const tick of ticks) {
            const symbol = tick.symbol || (tick.v && tick.v.symbol) || tick.s;
            let ltp = tick.ltp || tick.lp || (tick.v && tick.v.lp) || tick.last_price || (tick.v && tick.v.last_price);
            
            if (tick.type === 'if' || tick.type === 'sf') {
                 // specific Fyers websocket format adjustments if needed
            }

            if (!symbol || typeof ltp !== 'number') continue;

            const matchingTrades = activeTrades.filter(t => t.symbol === symbol);
            for (const trade of matchingTrades) {
                this.evaluateTrade(trade, ltp, isEod);
            }
        }
    }

    private evaluateTrade(trade: any, ltp: number, isEod: boolean) {
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
        else if ((ltp >= trade.targetPrice && trade.direction === 'LONG') || (ltp <= trade.targetPrice && trade.direction === 'SHORT')) {
            // Take Profit hit - fill exactly at target price
            const finalDiff = trade.direction === 'LONG' ? trade.targetPrice - trade.entryPrice : trade.entryPrice - trade.targetPrice;
            const finalPnl = finalDiff * trade.qty;
            const finalRr = riskAmount > 0 ? finalDiff / riskAmount : 0;

            DB.closeTrade.run({
                status: 'TP',
                exitTime: new Date().toISOString(),
                exitPrice: trade.targetPrice,
                pnl: finalPnl,
                rr: finalRr,
                symbol: trade.symbol
            });
            console.log(`✅ TP Hit for ${trade.symbol} at ₹${trade.targetPrice} | PnL: ₹${finalPnl.toFixed(2)}`);
            EventBus.emit(Events.TRADE_CLOSED, { ...trade, exitPrice: trade.targetPrice, status: 'TP' });
        } 
        else if ((ltp <= trade.stopPrice && trade.direction === 'LONG') || (ltp >= trade.stopPrice && trade.direction === 'SHORT')) {
            // Stop Loss hit - fill exactly at stop price to honor strict risk definition
            const finalDiff = trade.direction === 'LONG' ? trade.stopPrice - trade.entryPrice : trade.entryPrice - trade.stopPrice;
            const finalPnl = finalDiff * trade.qty;
            const finalRr = riskAmount > 0 ? finalDiff / riskAmount : 0;

            DB.closeTrade.run({
                status: 'SL',
                exitTime: new Date().toISOString(),
                exitPrice: trade.stopPrice,
                pnl: finalPnl,
                rr: finalRr,
                symbol: trade.symbol
            });
            console.log(`❌ SL Hit for ${trade.symbol} at ₹${trade.stopPrice} | PnL: ₹${finalPnl.toFixed(2)}`);
            EventBus.emit(Events.TRADE_CLOSED, { ...trade, exitPrice: trade.stopPrice, status: 'SL' });
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
