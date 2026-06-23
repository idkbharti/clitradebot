
import { getQuotes } from "../services/fyers/getQuotes.ts";
import { NIFTY_100 } from "../services/fyers/nifty100.ts";
import { state, getToken } from "./state.ts";

const INTERVAL = 10_000;

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
        `║${title.padStart(
            (width + title.length) / 2
        ).padEnd(width)}║`
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

export async function startScanner() {
    if (state.running) return;

    const token = getToken();

    if (!token) {
        console.log("❌ No token found. Run: npm run setup");
        return;
    }

    state.running = true;

    while (state.running) {
        try {
            const quotes = await getQuotes(NIFTY_100);

            const gainers = quotes.d
                .map((s: any) => ({
                    symbol: s.v.symbol,
                    name: String(s.v.short_name).replace(
                        "-EQ",
                        ""
                    ),
                    chp: Number(s.v.chp),
                    open: Number(s.v.open_price),
                    high: Number(s.v.high_price),
                    low: Number(s.v.low_price),
                    ltp: Number(s.v.lp),
                }))
                .sort(
                    (a: any, b: any) => b.chp - a.chp
                );

            clear();

            header("🚀 F&O TOP 20 GAINERS");

            console.log(
                "Rank Symbol           Change      LTP           Signal"
            );
            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            gainers
                .slice(0, 20)
                .forEach((s: any, index: number) => {
                    let signal = "";

                    const range =
                        s.high - s.low;

                    if (range > 0) {
                        const fib618 =
                            s.high -
                            range * 0.618;

                        const isInZone =
                            s.ltp >= s.low &&
                            s.ltp <= fib618;

                        if (isInZone) {
                            signal =
                                "🎯 FIBZONE";
                        }
                    }

                    const rank =
                        getRank(index);

                    const change =
                        s.chp >= 0
                            ? `🟢 ${s.chp.toFixed(
                                2
                            )}%`
                            : `🔴 ${Math.abs(
                                s.chp
                            ).toFixed(2)}%`;

                    console.log(
                        `${rank.padEnd(4)} ` +
                        `${s.name.padEnd(
                            16
                        )}` +
                        `${change.padEnd(
                            14
                        )}` +
                        `₹${s.ltp
                            .toFixed(2)
                            .padEnd(12)}` +
                        `${signal}`
                    );
                });

            console.log();

            console.log(
                "────────────────────────────────────────────────────────────────────"
            );

            console.log(
                `⏰ Last Update : ${new Date().toLocaleTimeString()}`
            );

            console.log(
                `🔄 Refresh    : ${INTERVAL / 1000}s`
            );

            console.log(
                `📊 Symbols    : 20`
            );

            console.log();

            console.log(
                "Press Ctrl+C to stop scanner"
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

    console.log("\n🛑 Scanner Stopped");
}