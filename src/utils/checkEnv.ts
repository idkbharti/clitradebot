import fs from "fs";

export function checkEnv() {
    if (!fs.existsSync(".env")) {
        console.log("❌ .env not found");
        console.log("Run: npm run setup");
        process.exit(1);
    }
}