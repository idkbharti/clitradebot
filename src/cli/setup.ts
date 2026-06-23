import fs from "fs";
import path from "path";
import readline from "readline";
import app from '../app.ts'
import { env } from '../config/env.ts'


const ENV_PATH = path.join(process.cwd(), ".env");
const TOKEN_PATH = path.join(
    process.cwd(),
    "src/data/token.json"
);

function ask(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createOrUpdateEnv() {
    let shouldUpdate = true;

    if (fs.existsSync(ENV_PATH)) {
        const currentEnv = fs.readFileSync(ENV_PATH, "utf8");

        console.log("\n========================");
        console.log("CURRENT CONFIG");
        console.log("========================");
        console.log(currentEnv.trim());

        const answer = await ask(
            "\nUpdate configuration? (y/n): "
        );

        shouldUpdate = answer.toLowerCase() === "y";
    }

    if (!shouldUpdate) {
        return;
    }

    console.log("\n========================");
    console.log("FYERS SETUP");
    console.log("========================\n");

    const clientId = await ask(
        "Fyers Client ID: "
    );

    const secretKey = await ask(
        "Fyers Secret Key: "
    );

    const envContent = [
        "PORT=5000",
        `FYERS_CLIENT_ID=${clientId}`,
        `FYERS_SECRET_KEY=${secretKey}`,
        "FYERS_REDIRECT_URI=http://127.0.0.1:5000/auth/callback",
    ].join("\n");

    fs.writeFileSync(ENV_PATH, envContent);

    console.log("\n✅ .env updated");
}

async function ensureToken(): Promise<boolean> {
    if (fs.existsSync(TOKEN_PATH)) {
        const answer = await ask(
            "\nGenerate new token? (y/n): "
        );

        if (answer.toLowerCase() !== "y") {
            console.log("\n✅ Existing token retained");
            return false; // no login required
        }

        fs.unlinkSync(TOKEN_PATH);

        console.log("\n🗑 Old token removed");
    }

    return true; // login required
}

async function generateToken() {
    const server = app.listen(env.PORT);

    console.log("\n========================");
    console.log("LOGIN REQUIRED");
    console.log("========================");

    console.log("\nOpen in browser:");
    console.log("http://127.0.0.1:5000/auth/login");

    console.log("\nWaiting for token generation...");

    while (!fs.existsSync(TOKEN_PATH)) {
        await sleep(1000);
    }

    server.close();

    console.log("✅ Token saved");
}

async function main() {
    await createOrUpdateEnv();

    const loginRequired = await ensureToken();

    if (loginRequired) {
        await generateToken();
    }

    console.log("\n🎉 Setup Complete");
    console.log("\nRun scanner with:\n");
    console.log("npm run bot");
}

main().catch(console.error);
