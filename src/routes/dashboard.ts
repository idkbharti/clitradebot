import { Router } from "express";
import { fibTracker, latestTopGainers, scannerLastUpdate } from "../cli/scanner.ts";
import { pdhTracker } from "../cli/pdhScanner.ts";
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

router.get("/data", (req, res) => {
    try {
        let fibHistory = [];
        let pdhHistory = [];
        let fibWinRate = 0;
        let pdhWinRate = 0;

        if (fs.existsSync(dbPath)) {
            const db = new Database(dbPath, { readonly: true });
            
            try {
                fibHistory = db.prepare(`SELECT * FROM trades ORDER BY entryTime DESC LIMIT 50`).all() as any[];
                fibWinRate = calculateWinRate(fibHistory);
            } catch (e) {
                // Table might not exist
            }

            try {
                pdhHistory = db.prepare(`SELECT * FROM pdh_trades ORDER BY entryTime DESC LIMIT 50`).all() as any[];
                pdhWinRate = calculateWinRate(pdhHistory);
            } catch (e) {
                // Table might not exist
            }
            
            db.close();
        }

        const now = new Date();
        const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // Approximate IST
        let statusText = "Offline";
        
        if (currentHour >= 9.25 && currentHour < 9.5) {
            statusText = "Active (Waiting for 9:30)";
        } else if (currentHour >= 9.5 && currentHour < 15.5) {
            statusText = "Active (Scanning)";
        }

        res.json({
            success: true,
            status: statusText,
            lastUpdate: scannerLastUpdate,
            topGainers: latestTopGainers,
            fibTracker: Array.from(fibTracker.values()),
            pdhTracker: Array.from(pdhTracker.values()),
            history: {
                fib: fibHistory,
                pdh: pdhHistory,
                fibWinRate,
                pdhWinRate
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

export default router;
