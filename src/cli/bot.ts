import fs from "fs";
import path from "path";
import { startScanner } from "./scanner.ts";

const TOKEN_PATH = path.join(
    process.cwd(),
    "src/data/token.json"
);

async function main() {
    if (!fs.existsSync(".env")) {
        console.log("❌ .env missing");
        console.log("Run: npm run setup");
        return;
    }

    if (!fs.existsSync(TOKEN_PATH)) {
        console.log("❌ Token missing");
        console.log("");
        console.log("Login first:");
        console.log("http://127.0.0.1:5000/auth/login");
        return;
    }

    await startScanner();
}

main();