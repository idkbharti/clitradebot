import app from './app.ts'
import { env } from './config/env.ts'
import { startScanner, stopScanner } from "./cli/scanner.ts";
import cron from "node-cron";
import axios from "axios";
import { isTodayHoliday } from "./config/holidays.ts";
import { fetchHolidays } from "./cli/fetchHolidays.ts";

console.log("CLIENT ID:", env.FYERS_CLIENT_ID);
console.log("REDIRECT URI:", env.FYERS_REDIRECT_URI);

app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);

    // Schedule Holidays Fetcher: Run at midnight on the 1st of every month
    cron.schedule("0 0 1 * *", () => {
        console.log("⏰ Cron Triggered: Fetching holidays for the new month");
        fetchHolidays();
    }, {
        timezone: "Asia/Kolkata"
    });

    // Schedule Auto Browser Login Request: Start at 09:15 AM Monday-Friday
    cron.schedule("15 9 * * 1-5", async () => {
        if (isTodayHoliday()) return;
        
        console.log("⏰ Cron Triggered: Attempting automated login request (09:15 AM)");
        const url = `http://127.0.0.1:${env.PORT}/auth/login`;
        
        try {
            await axios.get(url);
            console.log("✅ Auto login request sent successfully.");
        } catch (error: any) {
            console.error("❌ Failed to complete auto login request:", error.message);
        }
    }, {
        timezone: "Asia/Kolkata" 
    });

    // Schedule Scanner (Top Gainers + Trading): Start at 09:15 AM Monday-Friday
    cron.schedule("15 9 * * 1-5", () => {
        if (isTodayHoliday()) {
            console.log("🌴 Today is a market holiday. Skipping scanner.");
            return;
        }
        
        console.log("⏰ Cron Triggered: Starting Market Scanner (09:15 AM)");
        startScanner();
    }, {
        timezone: "Asia/Kolkata" // Assuming IST, standard for NSE/BSE
    });

    // Schedule Scanner: Stop at 03:15 PM Monday-Friday
    cron.schedule("15 15 * * 1-5", () => {
        console.log("⏰ Cron Triggered: Stopping Market Scanner (03:15 PM)");
        stopScanner();
    }, {
        timezone: "Asia/Kolkata"
    });

    console.log("🕒 Cron schedules for Market Scanner are set (09:15 AM to 03:15 PM Mon-Fri)");

    // Start immediately if it's currently between 9:15 AM and 3:15 PM Mon-Fri in IST
    const now = new Date();
    const currentHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60; // Approximate IST hour
    const day = now.getUTCDay();
    // 9.25 = 9:15 AM, 15.25 = 3:15 PM
    if (!isTodayHoliday() && day >= 1 && day <= 5 && currentHour >= 9.25 && currentHour <= 15.25) {
        console.log("Current time is within market hours. Starting scanner immediately...");
        startScanner();
    } else if (isTodayHoliday()) {
        console.log("🌴 Today is a market holiday. Scanner will not start today.");
    }
})
