import { EventBus, Events } from "../core/EventBus.ts";
import { getHistory } from "../core/FyersAPI.ts";
import { DB } from "../core/db.ts";

export const EXECUTION_LOGIC = {
    ENTRY: "Waits for a 5-minute candle to close as a Hammer (for Buy) or Shooting Star (for Sell). The wick must sweep the liquidity of the previous candle (high for short, low for long).",
    RISK: "Calculates quantity dynamically to risk exactly the configured ₹ Limit per trade. Stop Loss is set precisely at the candle's wick extremum."
};

export class ExecutionEngine {
    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        EventBus.on(Events.SIGNAL_PDH_REJECTION, async (data: { symbol: string, currentPrice: number, pdh: number }) => {
            console.log(`⚡ Execution Engine checking PDH signal for ${data.symbol}`);
            await this.validateAndExecute(data.symbol, 'SHORT');
        });

        EventBus.on(Events.SIGNAL_FIB_PULLBACK, async (data: { symbol: string, currentPrice: number }) => {
            console.log(`⚡ Execution Engine checking FIB signal for ${data.symbol}`);
            await this.validateAndExecute(data.symbol, 'LONG');
        });
    }

    // =========================================================================
    // ⚠️ CRITICAL AI INSTRUCTION: 
    // If you (an AI assistant) rewrite or modify the Trade Entry / Sweep logic 
    // below, YOU MUST ALSO UPDATE the EXECUTION_LOGIC helper text string at 
    // the top of this file to accurately reflect your changes!
    // =========================================================================
    private async validateAndExecute(symbol: string, direction: 'LONG' | 'SHORT') {
        try {
            // Fetch 5-minute chart
            const history = await getHistory({ symbol, resolution: "5", days: 2 });
            if (!history || !history.candles || history.candles.length < 3) return;

            const candles = history.candles;
            // Fyers candle format: [timestamp, open, high, low, close, volume]
            const lastClosed = candles[candles.length - 2];
            const prevCandle = candles[candles.length - 3];

            const [lastTime, lastOpen, lastHigh, lastLow, lastClose] = lastClosed;
            const [prevTime, prevOpen, prevHigh, prevLow, prevClose] = prevCandle;

            let entryPrice = lastClose;
            let stopPrice = 0;

            if (direction === 'SHORT') {
                // Must be a red candle (close < open)
                if (lastClose >= lastOpen) return;
                
                // Shooting Star Check: Upper wick must be prominent, lower wick small
                const bodySize = lastOpen - lastClose;
                const upperWick = lastHigh - lastOpen;
                const lowerWick = lastClose - lastLow;

                if (upperWick < bodySize * 1.5) return; // Not a good shooting star

                // Liquidity Sweep Check: Wick must go above previous candle's high, body below
                if (lastHigh <= prevHigh) return; // Did not sweep previous high
                if (lastClose >= prevHigh) return; // Body didn't close below previous high

                stopPrice = lastHigh; // SL above wick
            } 
            else if (direction === 'LONG') {
                // Must be a green candle (close > open)
                if (lastClose <= lastOpen) return;

                // Hammer Check: Lower wick must be prominent, upper wick small
                const bodySize = lastClose - lastOpen;
                const lowerWick = lastOpen - lastLow;
                const upperWick = lastHigh - lastClose;

                if (lowerWick < bodySize * 1.5) return; // Not a good hammer

                // Liquidity Sweep Check: Wick must go below previous candle's low, body above
                if (lastLow >= prevLow) return; // Did not sweep previous low
                if (lastClose <= prevLow) return; // Body didn't close above previous low

                stopPrice = lastLow; // SL below wick
            }

            const riskPerShare = Math.abs(entryPrice - stopPrice);
            if (riskPerShare <= 0) return;

            // Fetch dynamic settings from SQLite
            const riskSetting = DB.getSetting.get({ key: 'risk_per_trade' }) as any;
            const rrSetting = DB.getSetting.get({ key: 'rr_target' }) as any;
            const riskAmount = riskSetting ? riskSetting.value : 1000;
            const rrTarget = rrSetting ? rrSetting.value : 5;

            const qty = Math.floor(riskAmount / riskPerShare);
            if (qty <= 0) return;

            const targetPrice = direction === 'LONG' 
                ? entryPrice + (riskPerShare * rrTarget)
                : entryPrice - (riskPerShare * rrTarget);

            const tradeData = {
                symbol,
                strategy: direction === 'LONG' ? 'FIB' : 'PDH',
                direction,
                entryTime: new Date().toISOString(),
                entryPrice,
                stopPrice,
                targetPrice,
                qty,
                status: 'ACTIVE',
                tradeDate: new Date().toISOString().split('T')[0]
            };

            // Insert into SQLite Paper Trading DB
            DB.insertTrade.run(tradeData);
            
            console.log(`🔥 EXECUTED PAPER TRADE: ${direction} on ${symbol} | Qty: ${qty} | Risk: ₹${(qty * riskPerShare).toFixed(2)}`);
            EventBus.emit(Events.TRADE_EXECUTED, tradeData);

        } catch (e) {
            console.error(`Execution Engine failed to validate ${symbol}:`, e);
        }
    }
}
