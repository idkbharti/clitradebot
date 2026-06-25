import app from './app.ts'
import { env } from './config/env.ts'
import { startScanner, stopScanner } from "./cli/scanner.ts";
import cron from "node-cron";

console.log("CLIENT ID:", env.FYERS_CLIENT_ID);
console.log("REDIRECT URI:", env.FYERS_REDIRECT_URI);

app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);

    // Schedule Scanner: Start at 09:30 AM Monday-Friday
    cron.schedule("30 9 * * 1-5", () => {
        console.log("⏰ Cron Triggered: Starting Market Scanner (09:30 AM)");
        startScanner();
    }, {
        timezone: "Asia/Kolkata" // Assuming IST, standard for NSE/BSE
    });

    // Schedule Scanner: Stop at 03:30 PM Monday-Friday
    cron.schedule("30 15 * * 1-5", () => {
        console.log("⏰ Cron Triggered: Stopping Market Scanner (03:30 PM)");
        stopScanner();
    }, {
        timezone: "Asia/Kolkata"
    });

    console.log("🕒 Cron schedules for Market Scanner are set (09:30 AM to 03:30 PM Mon-Fri)");

    // Start immediately if it's currently between 9:30 AM and 3:30 PM Mon-Fri in IST
    const now = new Date();
    const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // Approximate IST hour
    const day = now.getUTCDay();
    if (day >= 1 && day <= 5 && currentHour >= 9.5 && currentHour <= 15.5) {
        console.log("Current time is within market hours. Starting scanner immediately...");
        startScanner();
    }
})
