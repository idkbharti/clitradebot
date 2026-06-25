import { getQuotes } from "../services/fyers/getQuotes.ts";
import { NIFTY_100 } from "../services/fyers/nifty100.ts";
import { state, getToken } from "./state.ts";
import { processPdhSweep, updatePdhTrades, pdhTracker } from "./pdhScanner.ts";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const INTERVAL = 10_000;
const RISK_PER_TRADE = 1000;

export type FibTrade = {
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
    fib618?: number;
    exitTime?: Date;
    exitPrice?: number;
    qty?: number;
    pnl?: number;
    rr?: number;
};

export const fibTracker = new Map<string, FibTrade>();

export let latestTopGainers: any[] = [];
export let scannerLastUpdate = "";

const dbDir = path.join(process.cwd(), "src/data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, "trades.db"));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    symbol TEXT,
    name TEXT,
    entryTime TEXT,
    entryPrice REAL,
    dayHigh REAL,
    dayLow REAL,
    fib618 REAL,
    status TEXT,
    exitTime TEXT,
    exitPrice REAL,
    tradeDate TEXT,
    PRIMARY KEY (symbol, tradeDate)
  );

  CREATE TABLE IF NOT EXISTS pdh_trades (
    symbol TEXT,
    name TEXT,
    entryTime TEXT,
    entryPrice REAL,
    dayHigh REAL,
    dayLow REAL,
    fib618 REAL,
    status TEXT,
    exitTime TEXT,
    exitPrice REAL,
    tradeDate TEXT,
    PRIMARY KEY (symbol, tradeDate)
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO trades (
    symbol, name, entryTime, entryPrice, dayHigh, dayLow, fib618, status, exitTime, exitPrice, tradeDate
  ) VALUES (
    @symbol, @name, @entryTime, @entryPrice, @dayHigh, @dayLow, @fib618, @status, @exitTime, @exitPrice, @tradeDate
  )
  ON CONFLICT(symbol, tradeDate) DO UPDATE SET
    status = excluded.status,
    exitTime = excluded.exitTime,
    exitPrice = excluded.exitPrice,
    dayHigh = excluded.dayHigh,
    dayLow = excluded.dayLow
`);

const upsertPdhStmt = db.prepare(`
  INSERT INTO pdh_trades (
    symbol, name, entryTime, entryPrice, dayHigh, dayLow, fib618, status, exitTime, exitPrice, tradeDate
  ) VALUES (
    @symbol, @name, @entryTime, @entryPrice, @dayHigh, @dayLow, @fib618, @status, @exitTime, @exitPrice, @tradeDate
  )
  ON CONFLICT(symbol, tradeDate) DO UPDATE SET
    status = excluded.status,
    exitTime = excluded.exitTime,
    exitPrice = excluded.exitPrice,
    dayHigh = excluded.dayHigh,
    dayLow = excluded.dayLow
`);

function saveTradeToDailyLog(trade: FibTrade) {
    const today = trade.enteredAt.toISOString().split('T')[0];
    
    upsertStmt.run({
        symbol: trade.symbol,
        name: trade.name,
        entryTime: trade.enteredAt.toISOString(),
        entryPrice: trade.entryPrice,
        dayHigh: trade.dayHigh ?? null,
        dayLow: trade.dayLow ?? null,
        fib618: trade.fib618 ?? null,
        status: trade.status,
        exitTime: trade.exitTime ? trade.exitTime.toISOString() : null,
        exitPrice: trade.exitPrice ?? null,
        tradeDate: today
    });
}

function savePdhTradeToDailyLog(trade: any) {
    const today = trade.enteredAt.toISOString().split('T')[0];
    
    upsertPdhStmt.run({
        symbol: trade.symbol,
        name: trade.name,
        entryTime: trade.enteredAt.toISOString(),
        entryPrice: trade.entryPrice,
        dayHigh: trade.dayHigh ?? null,
        dayLow: trade.dayLow ?? null,
        fib618: trade.fib618 ?? null,
        status: trade.status,
        exitTime: trade.exitTime ? trade.exitTime.toISOString() : null,
        exitPrice: trade.exitPrice ?? null,
        tradeDate: today
    });
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clear() {
    process.stdout.write("\x1Bc");
}

function header(title: string) {
    const width = 70;

    console.log(
        "╔" + "═".repeat(width) + "╗"
    );

    console.log(
        `║${title
            .padStart((width + title.length) / 2)
            .padEnd(width)}║`
    );

    console.log(
        "╚" + "═".repeat(width) + "╝"
    );

    console.log();
}

function getRank(index: number) {
    switch (index) {
        case 0:
            return "🥇";
        case 1:
            return "🥈";
        case 2:
            return "🥉";
        default:
            return `${index + 1}.`;
    }
}

function loadTodayTrades() {
    const today = new Date().toISOString().split('T')[0];
    try {
        const todayFib = db.prepare(`SELECT * FROM trades WHERE tradeDate = ?`).all(today) as any[];
        for (const row of todayFib) {
            fibTracker.set(row.symbol, {
                symbol: row.symbol,
                name: row.name,
                entryPrice: row.entryPrice,
                targetPrice: row.dayHigh || 0,
                stopPrice: row.dayLow || 0,
                currentPrice: row.exitPrice || row.entryPrice,
                status: row.status,
                enteredAt: new Date(row.entryTime),
                dayHigh: row.dayHigh,
                dayLow: row.dayLow,
                fib618: row.fib618,
                exitTime: row.exitTime ? new Date(row.exitTime) : undefined,
                exitPrice: row.exitPrice,
                qty: 0, // Not saved in DB currently, can be re-calculated if needed
                pnl: 0,
                rr: 0
            });
        }

        const todayPdh = db.prepare(`SELECT * FROM pdh_trades WHERE tradeDate = ?`).all(today) as any[];
        for (const row of todayPdh) {
            pdhTracker.set(row.symbol, {
                symbol: row.symbol,
                name: row.name,
                entryPrice: row.entryPrice,
                targetPrice: row.dayHigh || 0, // Using placeholders, logic might differ
                stopPrice: row.dayLow || 0,
                currentPrice: row.exitPrice || row.entryPrice,
                status: row.status,
                enteredAt: new Date(row.entryTime),
                dayHigh: row.dayHigh,
                dayLow: row.dayLow,
                exitTime: row.exitTime ? new Date(row.exitTime) : undefined,
                exitPrice: row.exitPrice,
                qty: 0,
                pnl: 0,
                rr: 0
            });
        }
        console.log(`Loaded ${todayFib.length} Fib and ${todayPdh.length} PDH trades for today from DB.`);
    } catch (e) {
        console.error("Error loading today's trades from DB", e);
    }
}

export async function startScanner() {
    if (state.running) return;

    // Use environment token if API allows it or rely on existing session logic
    // For now we assume token is available or server bypasses it for public data
    state.running = true;
    console.log("Starting full scanner logic with PnL tracking...");
    
    // PREVENT DATA LOSS: Load today's trades into memory so we don't overwrite them
    loadTodayTrades();

    while (state.running) {
        try {
            const quotes = await getQuotes(NIFTY_100);

            const stocks = quotes.d
                .map((s: any) => ({
                    symbol: s.v.symbol,
                    name: String(
                        s.v.short_name
                    ).replace("-EQ", ""),
                    chp: Number(s.v.chp),
                    open: Number(
                        s.v.open_price
                    ),
                    high: Number(
                        s.v.high_price
                    ),
                    low: Number(
                        s.v.low_price
                    ),
                    ltp: Number(s.v.lp),
                }))
                .sort(
                    (a: any, b: any) =>
                        b.chp - a.chp
                );

            const top20 = stocks.slice(0, 20);
            latestTopGainers = top20;

            // Check if it's past 3:30 PM IST (EOD)
            const now = new Date();
            const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // Approximate IST
            const isEod = currentHour >= 15.5;

            // ====================================
            // FIND NEW ENTRIES FOR FIB
            // ====================================

            if (!isEod) {
                for (const stock of top20) {
                    const range = stock.high - stock.low;
                    if (range <= 0) continue;

                    const fib618 = stock.high - range * 0.618;
                    const isInFibZone = stock.ltp >= stock.low && stock.ltp <= fib618;

                    if (isInFibZone && !fibTracker.has(stock.symbol)) {
                        const riskAmount = stock.ltp - stock.low;
                        const qty = riskAmount > 0 ? Math.floor(RISK_PER_TRADE / riskAmount) : 0;

                        const newTrade: FibTrade = {
                            symbol: stock.symbol,
                            name: stock.name,
                            entryPrice: stock.ltp,
                            targetPrice: stock.high,
                            stopPrice: stock.low,
                            currentPrice: stock.ltp,
                            status: "ACTIVE",
                            enteredAt: new Date(),
                            dayHigh: stock.high,
                            dayLow: stock.low,
                            fib618: fib618,
                            qty: qty,
                            pnl: 0,
                            rr: 0
                        };
                        fibTracker.set(stock.symbol, newTrade);
                        saveTradeToDailyLog(newTrade);
                    }
                }
            }

            // ====================================
            // FIND NEW ENTRIES FOR PDH SWEEP
            // ====================================
            if (!isEod) {
                await processPdhSweep(stocks, savePdhTradeToDailyLog);
            }

            // ====================================
            // UPDATE ALL TRACKED TRADES
            // ====================================

            for (const stock of stocks) {
                const trade = fibTracker.get(stock.symbol);
                if (!trade) continue;

                trade.currentPrice = stock.ltp;
                
                // Recalculate Live PnL and RR for active trades
                if (trade.status === "ACTIVE") {
                    const diff = trade.currentPrice - trade.entryPrice;
                    trade.pnl = diff * (trade.qty || 0);
                    trade.rr = diff / (trade.entryPrice - trade.stopPrice);

                    if (isEod) {
                        trade.status = "CLOSED_EOD";
                        trade.exitTime = new Date();
                        trade.exitPrice = stock.ltp;
                        saveTradeToDailyLog(trade);
                    } else if (stock.ltp >= trade.targetPrice) {
                        trade.status = "TP";
                        trade.exitTime = new Date();
                        trade.exitPrice = stock.ltp;
                        saveTradeToDailyLog(trade);
                    } else if (stock.ltp <= trade.stopPrice) {
                        trade.status = "SL";
                        trade.exitTime = new Date();
                        trade.exitPrice = stock.ltp;
                        saveTradeToDailyLog(trade);
                    }
                }
            }

            // ====================================
            // UPDATE PDH TRADES
            // ====================================
            updatePdhTrades(stocks, savePdhTradeToDailyLog, isEod);

            scannerLastUpdate = new Date().toLocaleTimeString();

            clear();

            // ====================================
            // TOP GAINERS TABLE
            // ====================================

            header(
                "🚀 F&O TOP 20 GAINERS"
            );

            console.log(
                "Rank Symbol           Change      LTP           Signal"
            );

            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            top20.forEach(
                (
                    stock: any,
                    index: number
                ) => {
                    const trade =
                        fibTracker.get(
                            stock.symbol
                        );

                    let signal = "";

                    if (trade) {
                        switch (
                        trade.status
                        ) {
                            case "ACTIVE":
                                signal =
                                    "⏳ ACTIVE";
                                break;

                            case "TP":
                                signal =
                                    "✅ TP";
                                break;

                            case "SL":
                                signal =
                                    "❌ SL";
                                break;
                        }
                    }

                    const rank =
                        getRank(index);

                    const change =
                        stock.chp >= 0
                            ? `🟢 ${stock.chp.toFixed(
                                2
                            )}%`
                            : `🔴 ${Math.abs(
                                stock.chp
                            ).toFixed(2)}%`;

                    console.log(
                        `${rank.padEnd(
                            4
                        )} ` +
                        `${stock.name.padEnd(
                            16
                        )}` +
                        `${change.padEnd(
                            14
                        )}` +
                        `₹${stock.ltp
                            .toFixed(2)
                            .padEnd(
                                12
                            )}` +
                        `${signal}`
                    );
                }
            );

            console.log("\n");

            // ====================================
            // FIB TRACKER TABLE
            // ====================================

            header(
                "🎯 FIB TRADE TRACKER"
            );

            console.log(
                "Symbol          Entry      Current    Target     Stop       Status"
            );

            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            const fibTradesList = Array.from(fibTracker.values());

            if (fibTradesList.length === 0) {
                console.log("No Fib entries found yet.");
            } else {
                for (const trade of fibTradesList) {
                    const status =
                        trade.status === "ACTIVE"
                            ? "⏳ ACTIVE"
                            : trade.status === "TP"
                                ? "✅ TP"
                                : "❌ SL";

                    console.log(
                        `${trade.name.padEnd(15)}` +
                        `₹${trade.entryPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.currentPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.targetPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.stopPrice.toFixed(2).padEnd(11)}` +
                        status
                    );
                }
            }

            console.log("\n");

            // ====================================
            // PDH TRACKER TABLE
            // ====================================

            header(
                "📉 PDH SWEEP TRACKER"
            );

            console.log(
                "Symbol          Entry      Current    Target     Stop       Status"
            );

            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            const pdhTradesList = Array.from(pdhTracker.values());

            if (pdhTradesList.length === 0) {
                console.log("No PDH Sweep entries found yet.");
            } else {
                for (const trade of pdhTradesList) {
                    const status =
                        trade.status === "ACTIVE"
                            ? "⏳ ACTIVE"
                            : trade.status === "TP"
                                ? "✅ TP"
                                : "❌ SL";

                    console.log(
                        `${trade.name.padEnd(15)}` +
                        `₹${trade.entryPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.currentPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.targetPrice.toFixed(2).padEnd(11)}` +
                        `₹${trade.stopPrice.toFixed(2).padEnd(11)}` +
                        status
                    );
                }
            }

            const active =
                fibTradesList.filter(t => t.status === "ACTIVE").length +
                pdhTradesList.filter(t => t.status === "ACTIVE").length;

            const tp =
                fibTradesList.filter(t => t.status === "TP").length +
                pdhTradesList.filter(t => t.status === "TP").length;

            const sl =
                fibTradesList.filter(t => t.status === "SL").length +
                pdhTradesList.filter(t => t.status === "SL").length;

            console.log("\n");

            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            console.log(
                `⏰ Last Update : ${new Date().toLocaleTimeString()}`
            );

            console.log(
                `🔄 Refresh    : ${INTERVAL / 1000
                }s`
            );

            console.log(
                `📊 Top Gainers: 20`
            );

            console.log(
                `🎯 Tracked Fib: ${fibTracker.size}`
            );

            console.log(
                `📉 Tracked PDH: ${pdhTracker.size}`
            );

            console.log(
                `⏳ Active     : ${active}`
            );

            console.log(
                `✅ TP         : ${tp}`
            );

            console.log(
                `❌ SL         : ${sl}`
            );

            console.log(
                "\nPress Ctrl+C to stop scanner"
            );
        } catch (err) {
            console.error(
                "\n❌ Scanner Error:"
            );

            console.error(err);
        }

        await sleep(INTERVAL);
    }
}

export function stopScanner() {
    state.running = false;

    console.log(
        "\n🛑 Scanner Stopped"
    );
}