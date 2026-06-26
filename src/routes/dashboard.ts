import { Router } from "express";
import { fibTracker, latestTopGainers, scannerLastUpdate } from "../cli/scanner.ts";
import { pdhTracker } from "../cli/pdhScanner.ts";
import { isTodayHoliday } from "../config/holidays.ts";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const router = Router();
const dbDir = path.join(process.cwd(), "src/data");
const dbPath = path.join(dbDir, "trades.db");

function calculateWinRate(history: any[]) {
    if (!history || history.length === 0) return 0;
    const closedTrades = history.filter(t => t.status === 'TP' || t.status === 'SL');
    if (closedTrades.length === 0) return 0;
    const wins = closedTrades.filter(t => t.status === 'TP').length;
    return (wins / closedTrades.length) * 100;
}

function computeTradeStats(trades: any[], isFib: boolean) {
    const closedTrades = trades.filter(t => t.status === 'TP' || t.status === 'SL' || t.status === 'CLOSED_EOD');
    
    let totalPnl = 0;
    let totalRr = 0;
    let rrCount = 0;
    
    for (const t of closedTrades) {
        const entry = t.entryPrice || 0;
        const exit = t.exitPrice || entry;
        const high = t.dayHigh || 0;
        const low = t.dayLow || 0;
        
        if (isFib) {
            // FIB: Long trade
            const riskAmount = entry - low;
            const qty = riskAmount > 0 ? Math.floor(1000 / riskAmount) : 0;
            const diff = exit - entry;
            const pnl = diff * qty;
            const rr = riskAmount > 0 ? diff / riskAmount : 0;
            totalPnl += pnl;
            totalRr += rr;
            rrCount++;
        } else {
            // PDH: Short trade
            const riskAmount = high - entry;
            const qty = riskAmount > 0 ? Math.floor(1000 / riskAmount) : 0;
            const diff = entry - exit;
            const pnl = diff * qty;
            const rr = riskAmount > 0 ? diff / riskAmount : 0;
            totalPnl += pnl;
            totalRr += rr;
            rrCount++;
        }
    }
    
    return {
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgRr: rrCount > 0 ? Math.round((totalRr / rrCount) * 100) / 100 : 0
    };
}

router.get("/data", (req, res) => {
    try {
        let fibHistory: any[] = [];
        let pdhHistory: any[] = [];
        let fibWinRate = 0;
        let pdhWinRate = 0;

        // Filter params
        const fromDate = req.query.from as string || '';
        const toDate = req.query.to as string || '';
        const strategy = req.query.strategy as string || 'all';
        const status = req.query.status as string || 'all';

        if (fs.existsSync(dbPath)) {
            const db = new Database(dbPath, { readonly: true });
            
            // Build WHERE clause for filters
            let dateFilter = '';
            const params: any[] = [];
            
            if (fromDate) {
                dateFilter += ' AND tradeDate >= ?';
                params.push(fromDate);
            }
            if (toDate) {
                dateFilter += ' AND tradeDate <= ?';
                params.push(toDate);
            }
            
            let statusFilter = '';
            if (status && status !== 'all') {
                statusFilter = ' AND status = ?';
            }

            try {
                if (strategy === 'all' || strategy === 'fib') {
                    const fibParams = [...params];
                    let fibQuery = `SELECT * FROM trades WHERE 1=1${dateFilter}`;
                    if (status !== 'all') {
                        fibQuery += statusFilter;
                        fibParams.push(status);
                    }
                    fibQuery += ' ORDER BY entryTime DESC';
                    fibHistory = db.prepare(fibQuery).all(...fibParams) as any[];
                    fibWinRate = calculateWinRate(fibHistory);
                }
            } catch (e) {
                // Table might not exist
            }

            try {
                if (strategy === 'all' || strategy === 'pdh') {
                    const pdhParams = [...params];
                    let pdhQuery = `SELECT * FROM pdh_trades WHERE 1=1${dateFilter}`;
                    if (status !== 'all') {
                        pdhQuery += statusFilter;
                        pdhParams.push(status);
                    }
                    pdhQuery += ' ORDER BY entryTime DESC';
                    pdhHistory = db.prepare(pdhQuery).all(...pdhParams) as any[];
                    pdhWinRate = calculateWinRate(pdhHistory);
                }
            } catch (e) {
                // Table might not exist
            }
            
            db.close();
        }

        // Compute stats
        const fibStats = computeTradeStats(fibHistory, true);
        const pdhStats = computeTradeStats(pdhHistory, false);

        const allHistory = [
            ...fibHistory.map(t => ({ ...t, strategy: 'FIB' })),
            ...pdhHistory.map(t => ({ ...t, strategy: 'PDH' }))
        ].sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());

        const allClosedTrades = allHistory.filter(t => t.status === 'TP' || t.status === 'SL');
        const overallWinRate = allClosedTrades.length > 0
            ? (allClosedTrades.filter(t => t.status === 'TP').length / allClosedTrades.length) * 100
            : 0;

        // Status calculation
        const now = new Date();
        const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60;
        const day = now.getUTCDay();
        const isHoliday = isTodayHoliday();
        const isWeekend = day === 0 || day === 6;
        
        let statusText = "Offline";
        let statusType = "offline";
        
        if (isHoliday) {
            statusText = "Offline (Holiday)";
            statusType = "holiday";
        } else if (isWeekend) {
            statusText = "Offline (Market Closed)";
            statusType = "offline";
        } else if (currentHour >= 9.25 && currentHour < 9.5) {
            statusText = "Active (Waiting for 9:30)";
            statusType = "waiting";
        } else if (currentHour >= 9.5 && currentHour < 15.5) { // up to 3:30 PM (15.5)
            statusText = "Online (Scanning)";
            statusType = "online";
        } else {
            statusText = "Offline (Market Closed)";
            statusType = "offline";
        }

        res.json({
            success: true,
            status: statusText,
            statusType,
            isHoliday,
            lastUpdate: scannerLastUpdate,
            topGainers: latestTopGainers,
            fibTracker: Array.from(fibTracker.values()),
            pdhTracker: Array.from(pdhTracker.values()),
            history: {
                trades: allHistory,
                fib: fibHistory,
                pdh: pdhHistory,
                fibWinRate,
                pdhWinRate,
                overallWinRate: Math.round(overallWinRate * 10) / 10,
                totalTrades: allHistory.length,
                tpCount: allHistory.filter(t => t.status === 'TP').length,
                slCount: allHistory.filter(t => t.status === 'SL').length,
                eodCount: allHistory.filter(t => t.status === 'CLOSED_EOD').length,
                activeCount: allHistory.filter(t => t.status === 'ACTIVE').length,
                totalPnl: Math.round((fibStats.totalPnl + pdhStats.totalPnl) * 100) / 100,
                avgRr: Math.round(((fibStats.avgRr + pdhStats.avgRr) / 2) * 100) / 100,
                fibStats,
                pdhStats
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

export default router;
