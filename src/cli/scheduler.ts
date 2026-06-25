import cron from "node-cron";
import { startScanner, stopScanner } from "./scanner.ts";
import { state } from "./state.ts";

console.log("⏰ Scheduler started! Bot will automatically run from 9:15 AM to 3:30 PM (Mon-Fri).");

// Start at 09:15 AM Monday to Friday
cron.schedule("15 9 * * 1-5", () => {
    console.log("\n🚀 Market opened! Starting scanner...");
    if (!state.running) {
        startScanner();
    }
}, {
    timezone: "Asia/Kolkata"
});

// Stop at 03:30 PM Monday to Friday
cron.schedule("30 15 * * 1-5", () => {
    console.log("\n🛑 Market closed! Stopping scanner...");
    if (state.running) {
        stopScanner();
    }
}, {
    timezone: "Asia/Kolkata"
});

// If the script is started during market hours, start it immediately
const now = new Date();
const timeString = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });
const day = now.getDay(); // 0 is Sun, 1 is Mon... 6 is Sat

if (day >= 1 && day <= 5) {
    if (timeString >= "09:15:00" && timeString < "15:30:00") {
        console.log("We are within market hours. Starting scanner immediately...");
        startScanner();
    } else {
        console.log("Outside market hours. Waiting for the next 9:15 AM trigger...");
    }
} else {
    console.log("It's the weekend. Waiting for Monday 9:15 AM...");
}
