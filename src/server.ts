import app from './app.ts'
import { env } from './config/env.ts'
import cron from "node-cron";
import axios from "axios";
import { isTodayHoliday } from "./config/holidays.ts";
import { fetchHolidays } from "./scrapers/fetchHolidays.ts";
import { fetchSectors } from "./scrapers/fetchSectors.ts";
import { ScannerEngine } from "./engines/ScannerEngine.ts";
import { ExecutionEngine } from "./engines/ExecutionEngine.ts";
import { RiskEngine } from "./engines/RiskEngine.ts";
import { EventBus } from "./core/EventBus.ts";
import http from "http";
import { Server } from "socket.io";

const scanner = new ScannerEngine();
const execution = new ExecutionEngine();
const risk = new RiskEngine();

const server = http.createServer(app);
export const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("🟢 Client connected to Dashboard WebSocket");
});

// Broadcast events
EventBus.on("TRADE_EXECUTED", (data) => io.emit("trade", { type: "EXECUTED", data }));
EventBus.on("TRADE_CLOSED", (data) => io.emit("trade", { type: "CLOSED", data }));
EventBus.on("SIGNAL_PDH_REJECTION", (data) => io.emit("signal", { type: "PDH", data }));
EventBus.on("SIGNAL_FIB_PULLBACK", (data) => io.emit("signal", { type: "FIB", data }));
EventBus.on("TRADE_TICK", (data) => io.emit("trade_tick", data));

console.log("CLIENT ID:", env.FYERS_CLIENT_ID);
console.log("REDIRECT URI:", env.FYERS_REDIRECT_URI);

server.listen(env.PORT, () => {
    console.log(`Server & WebSocket running on port ${env.PORT}`);

    // Schedule Monthly Fetchers: Run at midnight on the 1st of every month
    cron.schedule("0 0 1 * *", () => {
        console.log("⏰ Cron Triggered: Fetching holidays for the new month");
        fetchHolidays();
    }, {
        timezone: "Asia/Kolkata"
    });

    // Schedule Engines: Start at 09:15 AM Monday-Friday
    cron.schedule("15 9 * * 1-5", () => {
        if (isTodayHoliday()) {
            console.log("🌴 Today is a market holiday. Skipping trading engines.");
            return;
        }
        
        console.log("⏰ Cron Triggered: Starting Trading Engines (09:15 AM)");
        fetchSectors(); // Fetch fresh sector weighting at open
        scanner.start();
        risk.start();
    }, {
        timezone: "Asia/Kolkata" // Assuming IST, standard for NSE/BSE
    });

    // Schedule Engines: Stop at 03:15 PM Monday-Friday
    cron.schedule("15 15 * * 1-5", () => {
        console.log("⏰ Cron Triggered: Stopping Trading Engines (03:15 PM)");
        scanner.stop();
        // Risk engine handles EOD closure itself when it hits 15.25
        setTimeout(() => risk.stop(), 60000); // Stop risk engine after 1 minute buffer
    }, {
        timezone: "Asia/Kolkata"
    });

    console.log("🕒 Cron schedules for Trading Engines are set (09:15 AM to 03:15 PM Mon-Fri)");

    // Start immediately if it's currently between 9:15 AM and 3:15 PM Mon-Fri in IST
    const now = new Date();
    const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // Approximate IST hour
    const day = now.getUTCDay();
    // 9.25 = 9:15 AM, 15.25 = 3:15 PM
    if (!isTodayHoliday() && day >= 1 && day <= 5 && currentHour >= 9.25 && currentHour <= 15.25) {
        console.log("Current time is within market hours. Starting engines immediately...");
        scanner.start();
        risk.start();
    } else if (isTodayHoliday()) {
        console.log("🌴 Today is a market holiday. Engines will not start today.");
    }
})
