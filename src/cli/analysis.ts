import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import readline from "readline";

const dbDir = path.join(process.cwd(), "src/data");
const dbPath = path.join(dbDir, "trades.db");

if (!fs.existsSync(dbPath)) {
    console.log("❌ Database not found. Run the scanner first.");
    process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currentTable = "trades"; // Default table

function showOverallStats() {
    const totalTrades = db.prepare(`SELECT COUNT(*) as count FROM ${currentTable}`).get() as any;
    const tpTrades = db.prepare(`SELECT COUNT(*) as count FROM ${currentTable} WHERE status = 'TP'`).get() as any;
    const slTrades = db.prepare(`SELECT COUNT(*) as count FROM ${currentTable} WHERE status = 'SL'`).get() as any;
    const activeTrades = db.prepare(`SELECT COUNT(*) as count FROM ${currentTable} WHERE status = 'ACTIVE'`).get() as any;

    console.log(`\n📊 OVERALL STATISTICS (${currentTable === 'trades' ? 'FIB' : 'PDH'}) 📊`);
    console.log("───────────────────────────");
    console.log(`Total Trades Taken : ${totalTrades.count}`);
    console.log(`Total TP Hits      : ${tpTrades.count}`);
    console.log(`Total SL Hits      : ${slTrades.count}`);
    console.log(`Currently Active   : ${activeTrades.count}`);
    console.log("───────────────────────────\n");
    
    showMenu();
}

function showDailyStats() {
    rl.question("\n📅 Enter date (YYYY-MM-DD) or press Enter for today: ", (answer) => {
        const dateStr = answer.trim() || new Date().toISOString().split('T')[0];
        
        const trades = db.prepare(`SELECT * FROM ${currentTable} WHERE tradeDate = ? ORDER BY entryTime ASC`).all(dateStr) as any[];
        
        if (trades.length === 0) {
            console.log(`\n❌ No trades found for ${dateStr}\n`);
            showMenu();
            return;
        }

        console.log(`\n📅 TRADES FOR ${dateStr} (${currentTable === 'trades' ? 'FIB' : 'PDH'}) 📅`);
        console.log("──────────────────────────────────────────────────────────────────────────────────────────");
        console.log("Symbol          Entry Time        Entry ₹    Target ₹    Stop ₹      Status     Exit ₹");
        console.log("──────────────────────────────────────────────────────────────────────────────────────────");

        let tpCount = 0;
        let slCount = 0;
        let activeCount = 0;

        for (const t of trades) {
            const time = new Date(t.entryTime).toLocaleTimeString();
            const target = t.dayHigh ? t.dayHigh.toFixed(2) : "N/A";
            const stop = t.dayLow ? t.dayLow.toFixed(2) : "N/A";
            const exitP = t.exitPrice ? t.exitPrice.toFixed(2) : "-";
            
            let statusStr = "";
            if (t.status === "TP") {
                statusStr = "✅ TP";
                tpCount++;
            } else if (t.status === "SL") {
                statusStr = "❌ SL";
                slCount++;
            } else {
                statusStr = "⏳ ACTIVE";
                activeCount++;
            }

            console.log(
                `${t.symbol.padEnd(15)} ` +
                `${time.padEnd(17)} ` +
                `₹${t.entryPrice.toFixed(2).padEnd(9)} ` +
                `₹${target.padEnd(10)} ` +
                `₹${stop.padEnd(10)} ` +
                `${statusStr.padEnd(10)} ` +
                `${exitP !== "-" ? "₹" + exitP : exitP}`
            );
        }
        
        console.log("──────────────────────────────────────────────────────────────────────────────────────────");
        console.log(`Summary for ${dateStr}: Total=${trades.length} | TP=${tpCount} | SL=${slCount} | ACTIVE=${activeCount}\n`);

        showMenu();
    });
}

function selectStrategy() {
    console.log("\n⚙️ SELECT STRATEGY TO ANALYZE ⚙️");
    console.log("1. Fib Trades (0.618 Zone)");
    console.log("2. PDH Sweep Trades");
    
    rl.question("Select an option (1-2): ", (answer) => {
        const choice = answer.trim();
        if (choice === "1") {
            currentTable = "trades";
            console.log("✅ Switched to Fib Trades\n");
            showMenu();
        } else if (choice === "2") {
            currentTable = "pdh_trades";
            console.log("✅ Switched to PDH Trades\n");
            showMenu();
        } else {
            console.log("❌ Invalid option.\n");
            selectStrategy();
        }
    });
}

function showMenu() {
    console.log(`\n🔎 ANALYSIS MENU [Current Strategy: ${currentTable === 'trades' ? 'FIB' : 'PDH'}] 🔎`);
    console.log("1. Overall Statistics (Total Trades, TP, SL)");
    console.log("2. Daily Statistics (List trades by date)");
    console.log("3. Switch Strategy");
    console.log("4. Exit");
    
    rl.question("Select an option (1-4): ", (answer) => {
        const choice = answer.trim();
        if (choice === "1") {
            showOverallStats();
        } else if (choice === "2") {
            showDailyStats();
        } else if (choice === "3") {
            selectStrategy();
        } else if (choice === "4" || choice.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
        } else {
            console.log("❌ Invalid option.\n");
            showMenu();
        }
    });
}

console.log("\nStarting Analysis Tool...");
showMenu();
