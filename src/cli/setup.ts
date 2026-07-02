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

    const clientId = await ask("Fyers App ID (Client ID): ");
    const secretKey = await ask("Fyers App Secret Key: ");
    const pin = await ask("Fyers 4-Digit PIN: ");
    const refreshToken = await ask("Fyers Refresh Token (Leave blank if you want to generate one now): ");

    const envContent = [
        "PORT=5000",
        `FYERS_CLIENT_ID=${clientId}`,
        `FYERS_SECRET_KEY=${secretKey}`,
        `FYERS_REDIRECT_URI=http://127.0.0.1:5000/auth/callback`,
        `FYERS_PIN=${pin}`,
        `FYERS_REFRESH_TOKEN=${refreshToken}`
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
    // We don't need the express server if we handle it via CLI prompt
    // const server = app.listen(env.PORT);

    console.log("\n========================");
    console.log("LOGIN REQUIRED (VPS FLOW)");
    console.log("========================");

    const { fyersModel } = await import("fyers-api-v3");
    const { saveToken } = await import("../core/FyersAPI.ts");
    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);
    
    const loginUrl = fyers.generateAuthCode();
    
    console.log("\n1. Copy and paste this URL into your LOCAL computer's browser:");
    console.log(`\n\x1b[36m${loginUrl}\x1b[0m\n`);
    console.log("2. Log in to Fyers.");
    console.log("3. The browser will say 'This site can't be reached (127.0.0.1)'. This is normal!");
    console.log("4. Look at the address bar for auth_code=XXXXXX and copy it.");
    
    const authCode = await ask("\nPaste the auth_code here: ");
    
    if (!authCode) {
        console.log("❌ No auth_code provided. Token generation failed.");
        return;
    }
    
    try {
        console.log("\n🔄 Generating tokens using auth_code...");
        const response = await fyers.generate_access_token({
            client_id: env.FYERS_CLIENT_ID,
            secret_key: env.FYERS_SECRET_KEY,
            auth_code: authCode,
        });

        if (response.s !== "ok") {
            throw new Error(JSON.stringify(response));
        }

        saveToken(response);

        // ✅ Auto-save refresh_token back to .env so future restarts work automatically
        if (response.refresh_token) {
            let envContent = fs.readFileSync(ENV_PATH, 'utf8');
            if (envContent.includes('FYERS_REFRESH_TOKEN=')) {
                envContent = envContent.replace(/FYERS_REFRESH_TOKEN=.*/, `FYERS_REFRESH_TOKEN=${response.refresh_token}`);
            } else {
                envContent += `\nFYERS_REFRESH_TOKEN=${response.refresh_token}`;
            }
            fs.writeFileSync(ENV_PATH, envContent);
            console.log('✅ Refresh token auto-saved to .env!');
        }

        console.log("✅ Token successfully generated and saved to src/data/token.json!");
        console.log("\n🎉 Auto-login is now enabled. The server will refresh your token automatically every day at 09:10 AM.");
    } catch (e) {
        console.error("❌ Failed to generate token:", e);
    }
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
