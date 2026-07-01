import { EventBus, Events } from "../core/EventBus.ts";
import { getQuotes, getHistory, NIFTY_FNO } from "../core/FyersAPI.ts";
import fs from "fs";
import path from "path";

const SCANNER_INTERVAL_MS = 10000;

export let latestTopGainers: any[] = [];
export let latestSectorPerformance: any[] = [];
export let scannerLastUpdate = "";

export const SCANNER_LOGIC = {
    PDH: "Monitors Top 20 Gainers from NIFTY 500. Triggers a Sell Signal when a stock breaks above its Previous Day High (PDH) and then falls back below it.",
    FIB: "Monitors Top 2 Sector Indices. Scans constituent stocks for a pullback into the Golden Zone (0.5 to 0.789 Fibonacci Retracement). Triggers a Buy Signal if price actively bounces inside this zone."
};

export class ScannerEngine {
    private isRunning = false;
    private pdhCache = new Map<string, number>();

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🔭 Scanner Engine started.");
        this.loop();
    }

    public stop() {
        this.isRunning = false;
        console.log("🛑 Scanner Engine stopped.");
    }

    private async loop() {
        while (this.isRunning) {
            try {
                const now = new Date();
                const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // IST
                const isTradeExecutionTime = currentHour >= 9.25 && currentHour < 15.25;

                if (isTradeExecutionTime) {
                    await this.scanFno();
                    await this.scanSectors();
                }

            } catch (err) {
                console.error("Scanner Engine Error:", err);
            }
            await new Promise(r => setTimeout(r, SCANNER_INTERVAL_MS));
        }
    }

    // =========================================================================
    // ⚠️ CRITICAL AI INSTRUCTION: 
    // If you (an AI assistant) rewrite or modify the PDH scanning logic below, 
    // YOU MUST ALSO UPDATE the SCANNER_LOGIC.PDH helper text string at the 
    // top of this file to accurately reflect your changes!
    // =========================================================================
    private async scanFno() {
        const quotes: any[] = [];
        for (let i = 0; i < NIFTY_FNO.length; i += 50) {
            const chunk = NIFTY_FNO.slice(i, i + 50);
            const res = await getQuotes(chunk);
            if (res && res.d) quotes.push(...res.d);
            await new Promise(r => setTimeout(r, 200));
        }

        const stocks = quotes.filter(s => s && s.v && s.v.lp).map((s: any) => ({
            symbol: s.v.symbol,
            name: String(s.v.short_name).replace("-EQ", ""),
            chp: Number(s.v.chp),
            high: Number(s.v.high_price),
            ltp: Number(s.v.lp)
        })).sort((a, b) => b.chp - a.chp);

        // PDH Check for Top 20 Gainers
        const top20 = stocks.slice(0, 20);
        latestTopGainers = top20;
        scannerLastUpdate = new Date().toLocaleTimeString();
        for (const stock of top20) {
            let pdh = this.pdhCache.get(stock.symbol);
            if (!pdh) {
                try {
                    const history = await getHistory({ symbol: stock.symbol, resolution: "D", days: 4 });
                    if (history && history.candles && history.candles.length >= 2) {
                        pdh = history.candles[history.candles.length - 2][2]; // Prev high
                        this.pdhCache.set(stock.symbol, pdh);
                    }
                } catch (e) { }
            }

            if (pdh && stock.high >= pdh && stock.ltp < pdh) {
                // Emitting the event. ExecutionEngine will fetch the 5m chart and validate shooting star.
                EventBus.emit(Events.SIGNAL_PDH_REJECTION, { 
                    symbol: stock.symbol, 
                    currentPrice: stock.ltp, 
                    pdh 
                });
            }
        }
    }

    // =========================================================================
    // ⚠️ CRITICAL AI INSTRUCTION: 
    // If you (an AI assistant) rewrite or modify the FIB scanning logic below, 
    // YOU MUST ALSO UPDATE the SCANNER_LOGIC.FIB helper text string at the 
    // top of this file to accurately reflect your changes!
    // =========================================================================
    private async scanSectors() {
        const sectorsPath = path.join(process.cwd(), 'src/data/sectors.json');
        if (!fs.existsSync(sectorsPath)) return;
        
        const sectorsData = JSON.parse(fs.readFileSync(sectorsPath, 'utf-8'));
        const sectorIndices = Object.keys(sectorsData);
        if (sectorIndices.length === 0) return;

        const indexQuotes = await getQuotes(sectorIndices);
        const sortedIndices = indexQuotes.d
            .filter((s: any) => s.v && s.v.chp !== undefined)
            .sort((a: any, b: any) => b.v.chp - a.v.chp);

        if (sortedIndices.length >= 2) {
            latestSectorPerformance = sortedIndices.map((s: any) => ({
                name: String(s.v.short_name).replace("-INDEX", ""),
                chp: Number(s.v.chp)
            }));
            const top1 = sortedIndices[0].v.symbol;
            const top2 = sortedIndices[1].v.symbol;
            const targetStocks = [...(sectorsData[top1] || []), ...(sectorsData[top2] || [])];

            const quotes: any[] = [];
            for (let i = 0; i < targetStocks.length; i += 50) {
                const res = await getQuotes(targetStocks.slice(i, i + 50));
                if (res && res.d) quotes.push(...res.d);
                await new Promise(r => setTimeout(r, 200));
            }

            for (const item of quotes) {
                if (!item || !item.v) continue;
                const stock = item.v;
                const high = stock.high_price;
                const low = stock.low_price;
                const ltp = stock.lp;
                
                const range = high - low;
                if (range <= 0) continue;

                // Golden Zone calculation (0.5 to 0.789)
                const fib05 = high - (range * 0.5);
                const fib789 = high - (range * 0.789);

                // Is price actively in the golden zone?
                if (ltp <= fib05 && ltp >= fib789) {
                    EventBus.emit(Events.SIGNAL_FIB_PULLBACK, { 
                        symbol: stock.symbol, 
                        currentPrice: ltp 
                    });
                }
            }
        }
    }
}
