import { startScanner, stopScanner } from "./scanner.ts";
import { hasToken } from "./state.ts";
import fs from "fs";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "src/data/token.json");

export function handleCommand(cmd: string) {
    switch (cmd) {
        case "login":
            console.log("\n👉 Open this URL in browser:");
            console.log("http://127.0.0.1:5000/auth/login\n");
            break;

        case "start":
            if (!hasToken()) {
                console.log("❌ No token found. Run: login");
                return;
            }
            startScanner();
            break;

        case "stop":
            stopScanner();
            break;

        case "status":
            console.log({
                running: true
            });
            break;

        case "relogin":
            if (fs.existsSync(TOKEN_PATH)) {
                fs.unlinkSync(TOKEN_PATH);
            }
            console.log("Token cleared. Run login again.");
            break;

        default:
            console.log(`
Commands:
  login
  start
  stop
  status
  relogin
`);
    }
}