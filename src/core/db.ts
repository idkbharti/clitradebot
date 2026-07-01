import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbDir = path.join(process.cwd(), "src/data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
export const db = new Database(path.join(dbDir, "trades.db"));

db.pragma('journal_mode = WAL');

// We consolidate into a single trades table for both Fib and PDH for the new architecture.
db.exec(`
  CREATE TABLE IF NOT EXISTS active_trades (
    symbol TEXT,
    strategy TEXT,
    direction TEXT, -- 'LONG' or 'SHORT'
    entryTime TEXT,
    entryPrice REAL,
    stopPrice REAL,
    targetPrice REAL,
    qty INTEGER,
    status TEXT, -- 'ACTIVE', 'TP', 'SL', 'CLOSED_EOD'
    exitTime TEXT,
    exitPrice REAL,
    pnl REAL,
    rr REAL,
    tradeDate TEXT,
    PRIMARY KEY (symbol, tradeDate, strategy)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value REAL
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('risk_per_trade', 1000);
  INSERT OR IGNORE INTO settings (key, value) VALUES ('rr_target', 5);
`);

export const DB = {
    insertTrade: db.prepare(`
        INSERT INTO active_trades (
            symbol, strategy, direction, entryTime, entryPrice, stopPrice, targetPrice, qty, status, tradeDate
        ) VALUES (
            @symbol, @strategy, @direction, @entryTime, @entryPrice, @stopPrice, @targetPrice, @qty, @status, @tradeDate
        )
    `),
    updateTradeLive: db.prepare(`
        UPDATE active_trades 
        SET pnl = @pnl, rr = @rr 
        WHERE symbol = @symbol AND status = 'ACTIVE'
    `),
    closeTrade: db.prepare(`
        UPDATE active_trades 
        SET status = @status, exitTime = @exitTime, exitPrice = @exitPrice, pnl = @pnl, rr = @rr
        WHERE symbol = @symbol AND status = 'ACTIVE'
    `),
    getActiveTrades: db.prepare(`
        SELECT * FROM active_trades WHERE status = 'ACTIVE'
    `),
    getSetting: db.prepare(`
        SELECT value FROM settings WHERE key = @key
    `),
    updateSetting: db.prepare(`
        UPDATE settings SET value = @value WHERE key = @key
    `)
};
