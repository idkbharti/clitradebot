import { getQuotes } from "../services/fyers/getQuotes.ts";
import { NIFTY_100 } from "../services/fyers/niftyfno.js";

const SCAN_INTERVAL = 60_000;

export let scannerData = {
    gainers: [] as any[],
    fibCandidates: [] as any[],
    lastScanTime: null as string | null
};

let isRunning = false;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runScan() {
    try {
        const quotes = await getQuotes(NIFTY_100);

        const gainers = quotes.d
            .map((item: any) => ({
                symbol: item.v.symbol,
                name: item.v.short_name,
                chp: item.v.chp,
                open: item.v.open_price,
                high: item.v.high_price,
                low: item.v.low_price,
                ltp: item.v.lp,
                volume: item.v.volume,
            }))
            .sort((a: any, b: any) => b.chp - a.chp);

        console.clear();

        console.log("\n===========================");
        console.log("TOP GAINERS");
        console.log("===========================\n");

        gainers.slice(0, 10).forEach((stock: any, index: number) => {
            console.log(
                `${index + 1}. ${stock.name} | ${stock.chp}% | LTP: ${stock.ltp}`
            );
        });

        console.log("\n===========================");
        console.log("FIB RETRACEMENT CANDIDATES");
        console.log("===========================\n");

        let found = false;
        const fibCandidates = [];

        for (const stock of gainers.slice(0, 20)) {
            if (stock.chp < 3) continue;

            const move = stock.high - stock.open;

            if (move <= 0) continue;

            const fib50 = stock.high - move * 0.5;
            const fib618 = stock.high - move * 0.618;
            const fib786 = stock.high - move * 0.786;

            const inZone =
                stock.ltp <= fib50 &&
                stock.ltp >= fib786;

            if (!inZone) continue;

            found = true;
            fibCandidates.push({
                ...stock,
                fib50,
                fib786
            });

            console.log(`🚀 ${stock.name}`);
            console.log(`Change : ${stock.chp}%`);
            console.log(`Open   : ${stock.open}`);
            console.log(`High   : ${stock.high}`);
            console.log(`LTP    : ${stock.ltp}`);
            console.log(
                `Zone   : ${fib50.toFixed(2)} - ${fib786.toFixed(2)}`
            );
            console.log("");
        }

        if (!found) {
            console.log("No fib retracement candidates found.");
        }

        const lastScan = new Date().toLocaleTimeString();
        console.log(`\nLast Scan: ${lastScan}`);

        scannerData = {
            gainers: gainers.slice(0, 20),
            fibCandidates,
            lastScanTime: lastScan
        };

    } catch (error) {
        console.error("Scanner Error:", error);
    }
}

export async function startMarketScanner() {
    if (isRunning) return;
    console.log("Market Scanner Started\n");
    isRunning = true;

    while (isRunning) {
        await runScan();
        await sleep(SCAN_INTERVAL);
    }
}

export function stopMarketScanner() {
    console.log("Market Scanner Stopped\n");
    isRunning = false;
}