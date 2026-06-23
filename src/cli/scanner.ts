// import { getQuotes } from "../services/fyers/getQuotes.ts";
// import { NIFTY_100 } from "../services/fyers/nifty100.ts";
// import { state, getToken } from "./state.ts";

// const INTERVAL = 10_000; // realtime (10 sec)

// function sleep(ms: number) {
//     return new Promise(r => setTimeout(r, ms));
// }

// function clear() {
//     console.clear();
// }

// export async function startScanner() {
//     if (state.running) return;

//     const token = getToken();

//     if (!token) {
//         console.log("❌ No token found. Run: scanner login");
//         return;
//     }

//     state.running = true;

//     console.log("🚀 Scanner Started...\n");

//     while (state.running) {
//         try {
//             const quotes = await getQuotes(NIFTY_100);

//             const gainers = quotes.d
//                 .map((s: any) => ({
//                     symbol: s.v.symbol,
//                     name: s.v.short_name,
//                     chp: s.v.chp,
//                     open: s.v.open_price,
//                     high: s.v.high_price,
//                     ltp: s.v.lp,
//                 }))
//                 .sort((a: any, b: any) => b.chp - a.chp);

//             clear();

//             console.log("================================");
//             console.log("TOP GAINERS");
//             console.log("================================\n");

//             gainers.slice(0, 20).forEach((s: any, i: number) => {
//                 console.log(
//                     `${i + 1}. ${s.name} | ${s.chp}% | ${s.ltp}`
//                 );
//             });

//             console.log("\n================================");
//             console.log("FIB 0.618 WATCHLIST");
//             console.log("================================\n");

//             let found = false;

//             for (const s of gainers.slice(0, 20)) {
//                 const range = s.high - s.low;

//                 if (range <= 0) continue;

//                 const fib618 = s.high - range * 0.618;

//                 const diff = Math.abs(s.ltp - fib618);

//                 if (diff <= 0.5) {
//                     found = true;

//                     console.log(`🚨 ${s.name}`);
//                     console.log(`Open : ${s.open}`);
//                     console.log(`High : ${s.high}`);
//                     console.log(`LTP  : ${s.ltp}`);
//                     console.log(`Fib618: ${fib618.toFixed(2)}`);
//                     console.log(`Status: REVERSAL WATCH`);
//                     console.log("");
//                 }
//             }

//             if (!found) {
//                 console.log("No Fib setups right now...");
//             }

//             console.log("\nLast Update:", new Date().toLocaleTimeString());
//         } catch (err) {
//             console.error("Scanner error:", err);
//         }

//         await sleep(INTERVAL);
//     }
// }

// export function stopScanner() {
//     state.running = false;
//     console.log("🛑 Scanner Stopped");
// }


import { getQuotes } from "../services/fyers/getQuotes.ts";
import { NIFTY_100 } from "../services/fyers/nifty100.ts";
import { state, getToken } from "./state.ts";

const INTERVAL = 10_000; // 10 sec realtime scan

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function clear() {
    console.clear();
}

export async function startScanner() {
    if (state.running) return;

    const token = getToken();

    if (!token) {
        console.log("❌ No token found. Run: scanner login");
        return;
    }

    state.running = true;

    console.log("🚀 Scanner Started...\n");

    while (state.running) {
        try {
            const quotes = await getQuotes(NIFTY_100);

            // =========================
            // TOP GAINERS (TOP 20)
            // =========================
            const gainers = quotes.d
                .map((s: any) => ({
                    symbol: s.v.symbol,
                    name: s.v.short_name,
                    chp: s.v.chp,
                    open: s.v.open_price,
                    high: s.v.high_price,
                    low: s.v.low_price,
                    ltp: s.v.lp,
                }))
                .sort((a: any, b: any) => b.chp - a.chp);

            clear();

            console.log("================================");
            console.log("TOP 20 GAINERS");
            console.log("================================\n");

            gainers.slice(0, 20).forEach((s: any, i: number) => {
                console.log(
                    `${i + 1}. ${s.name} | ${s.chp}% | LTP: ${s.ltp}`
                );
            });

            // =========================
            // FIB 0.618 ZONE WATCHLIST
            // =========================
            console.log("\n================================");
            console.log("FIB 0.618 ZONE WATCHLIST");
            console.log("================================\n");

            let found = false;

            for (const s of gainers.slice(0, 20)) {
                const high = s.high;
                const low = s.low;
                const ltp = s.ltp;

                const range = high - low;

                if (range <= 0) continue;

                // Fib 0.618 from HIGH
                const fib618 = high - range * 0.618;

                // Zone logic:
                // LOW → Fib618 is accumulation/retracement zone
                const isInZone = ltp >= low && ltp <= fib618;

                if (isInZone) {
                    found = true;

                    console.log(`🚨 ${s.name}`);
                    console.log(`Change % : ${s.chp}%`);
                    console.log(`Open     : ${s.open}`);
                    console.log(`High     : ${high}`);
                    console.log(`Low      : ${low}`);
                    console.log(`LTP      : ${ltp}`);
                    console.log(`Fib618   : ${fib618.toFixed(2)}`);
                    console.log(`Status   : IN FIB ZONE (REVERSAL WATCH)`);
                    console.log("");
                }
            }

            if (!found) {
                console.log("No Fib 0.618 setups right now...");
            }

            console.log(
                "\nLast Update:",
                new Date().toLocaleTimeString()
            );
        } catch (err) {
            console.error("Scanner error:", err);
        }

        await sleep(INTERVAL);
    }
}

export function stopScanner() {
    state.running = false;
    console.log("🛑 Scanner Stopped");
}