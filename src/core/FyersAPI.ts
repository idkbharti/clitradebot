import { fyersModel } from "fyers-api-v3";
import fyersApiV3 from "fyers-api-v3";
const { fyersDataSocket } = fyersApiV3;
import { env } from "../config/env.ts";
import fs from "fs";
import path from "path";

// ==========================================
// TOKEN MANAGEMENT
// ==========================================
const DATA_DIR = path.join(process.cwd(), "src/data");
const TOKEN_FILE = path.join(DATA_DIR, "token.json");

export function saveToken(data: any) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

export function getToken() {
    try {
        const data = fs.readFileSync(TOKEN_FILE, "utf8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}

// ==========================================
// AUTH STATUS (exported for dashboard)
// ==========================================
export let authStatus: { ok: boolean; lastAuth: string | null; error: string | null } = {
    ok: false,
    lastAuth: null,
    error: null
};

// ==========================================
// AUTO-REFRESH using FYERS_REFRESH_TOKEN
// NOTE: Call this once at server startup.
// The refresh token is long-lived (6 months).
// It automatically generates a new access_token
// every day without any manual login.
// ==========================================
export async function autoRefreshToken(): Promise<boolean> {
    const refreshToken = env.FYERS_REFRESH_TOKEN;

    if (!refreshToken) {
        console.error("❌ FYERS_REFRESH_TOKEN is missing in .env. Run 'npm run setup' once to generate it.");
        return false;
    }

    try {
        // NOTE: Fyers has disabled the refresh token API per SEBI regulations.
        // We attempt the call, and if it fails, we fall back to the existing token.json.
        const axios = (await import("axios")).default;
        const response = await axios.post(
            "https://api-t1.fyers.in/api/v3/validate-refresh-token",
            {
                grant_type: "refresh_token",
                appIdHash: Buffer.from(`${env.FYERS_CLIENT_ID}:${env.FYERS_SECRET_KEY}`).toString("base64"),
                refresh_token: refreshToken,
                pin: env.FYERS_PIN,
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const data = response.data;
        if (data.s === "ok" && data.access_token) {
            const existing = getToken();
            saveToken({ ...existing, ...data });
            authStatus = { ok: true, lastAuth: new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }), error: null };
            console.log("✅ Access token auto-refreshed successfully");
            return true;
        }

        // API returned error (e.g. SEBI-disabled) — fall back to existing token.json
        const fallback = getToken();
        if (fallback?.access_token) {
            console.warn(`⚠️  Auto-refresh blocked by Fyers (${data.message}). Using existing token.json — run 'npm run setup' each morning.`);
            authStatus = { ok: true, lastAuth: "Existing token (setup)", error: null };
            return true;
        }

        authStatus = { ok: false, lastAuth: null, error: data.message || "No valid token" };
        console.error("❌ No valid token available. Run 'npm run setup' to authenticate.");
        return false;
    } catch (e: any) {
        // HTTP 400 error — check if response has a fallback message
        const errData = e?.response?.data;
        const fallback = getToken();
        if (fallback?.access_token) {
            const msg = errData?.message || String(e);
            console.warn(`⚠️  Auto-refresh failed (${msg}). Using existing token.json — run 'npm run setup' each morning.`);
            authStatus = { ok: true, lastAuth: "Existing token (setup)", error: null };
            return true;
        }
        authStatus = { ok: false, lastAuth: null, error: String(e) };
        console.error("❌ Auto-refresh error and no token.json found:", e);
        return false;
    }
}

// ==========================================
// CLIENT & API METHODS
// ==========================================
export function createFyersClient() {
    const tokenData = getToken();
    if (!tokenData) throw new Error("Token not found. Run 'npm run setup' first.");

    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setAccessToken(tokenData.access_token);
    return fyers;
}

export async function getQuotes(symbols: string[]) {
    const fyers = createFyersClient();
    return fyers.getQuotes(symbols);
}

export async function getHistory({ symbol, resolution = "D", days = 100 }: { symbol: string, resolution?: string, days?: number }) {
    const fyers = createFyersClient();
    const rangeTo = Math.floor(Date.now() / 1000);
    const rangeFrom = rangeTo - days * 24 * 60 * 60;

    return fyers.getHistory({
        symbol,
        resolution,
        date_format: "0",
        range_from: rangeFrom.toString(),
        range_to: rangeTo.toString(),
        cont_flag: "1",
    });
}

// ==========================================
// DATA WEBSOCKET
// ==========================================
export let dataSocket: any = null;
const activeSubscriptions = new Set<string>();

export function initDataSocket(onMessage: (msg: any) => void) {
    if (dataSocket) return dataSocket; // Already initialized

    const tokenData = getToken();
    if (!tokenData || !tokenData.access_token) {
        console.error("❌ Cannot init DataSocket: No access token found.");
        return null;
    }

    const appId = env.FYERS_CLIENT_ID;
    const authFormat = `${appId}:${tokenData.access_token}`;
    const logPath = path.join(process.cwd(), "src/data");

    try {
        dataSocket = fyersDataSocket.getInstance(authFormat, logPath, false);

        dataSocket.on("connect", () => {
            console.log("🔌 Fyers DataSocket Connected!");
            if (dataSocket.FullMode) {
                dataSocket.mode(dataSocket.FullMode);
            }
            if (activeSubscriptions.size > 0) {
                dataSocket.subscribe(Array.from(activeSubscriptions));
            }
        });

        dataSocket.on("message", (msg: any) => {
            onMessage(msg);
        });

        dataSocket.on("error", (err: any) => {
            console.error("Fyers DataSocket Error:", err);
        });

        if (typeof dataSocket.connect === 'function') {
            dataSocket.connect();
        }
        
        return dataSocket;
    } catch (err) {
        console.error("Failed to initialize Fyers DataSocket:", err);
        return null;
    }
}

export function subscribeToSymbol(symbol: string) {
    if (!activeSubscriptions.has(symbol)) {
        activeSubscriptions.add(symbol);
        if (dataSocket) {
            dataSocket.subscribe([symbol]);
        }
    }
}

export function unsubscribeFromSymbol(symbol: string) {
    if (activeSubscriptions.has(symbol)) {
        activeSubscriptions.delete(symbol);
        if (dataSocket) {
            dataSocket.unsubscribe([symbol]);
        }
    }
}

// ==========================================
// STATIC CONSTANTS
// ==========================================
export const NIFTY_FNO = [
    "NSE:ABB-EQ", "NSE:ABBOTINDIA-EQ", "NSE:ABCAPITAL-EQ", "NSE:ABFRL-EQ", "NSE:ACC-EQ",
    "NSE:ADANIENT-EQ", "NSE:ADANIPORTS-EQ", "NSE:ALKEM-EQ", "NSE:AMBUJACEM-EQ", "NSE:APOLLOHOSP-EQ",
    "NSE:APOLLOTYRES-EQ", "NSE:ASHOKLEY-EQ", "NSE:ASIANPAINT-EQ", "NSE:ASTRAL-EQ", "NSE:ATUL-EQ",
    "NSE:AUBANK-EQ", "NSE:AUROPHARMA-EQ", "NSE:AXISBANK-EQ", "NSE:BAJAJ-AUTO-EQ", "NSE:BAJAJFINSV-EQ",
    "NSE:BAJFINANCE-EQ", "NSE:BALRAMCHIN-EQ", "NSE:BANDHANBNK-EQ", "NSE:BANKBARODA-EQ", "NSE:BATAINDIA-EQ",
    "NSE:BEL-EQ", "NSE:BERGEPAINT-EQ", "NSE:BHARATFORG-EQ", "NSE:BHARTIARTL-EQ", "NSE:BHEL-EQ",
    "NSE:BIOCON-EQ", "NSE:BOSCHLTD-EQ", "NSE:BPCL-EQ", "NSE:BRITANNIA-EQ", "NSE:BSOFT-EQ",
    "NSE:CANBK-EQ", "NSE:CANFINHOME-EQ", "NSE:CHAMBLFERT-EQ", "NSE:CHOLAMFIN-EQ", "NSE:CIPLA-EQ",
    "NSE:COALINDIA-EQ", "NSE:COFORGE-EQ", "NSE:COLPAL-EQ", "NSE:CONCOR-EQ", "NSE:COROMANDEL-EQ",
    "NSE:CROMPTON-EQ", "NSE:CUB-EQ", "NSE:CUMMINSIND-EQ", "NSE:DABUR-EQ", "NSE:DALBHARAT-EQ",
    "NSE:DEEPAKNTR-EQ", "NSE:DIVISLAB-EQ", "NSE:DIXON-EQ", "NSE:DLF-EQ", "NSE:DRREDDY-EQ",
    "NSE:EICHERMOT-EQ", "NSE:ESCORTS-EQ", "NSE:EXIDEIND-EQ", "NSE:FEDERALBNK-EQ", "NSE:GAIL-EQ",
    "NSE:GLENMARK-EQ", "NSE:GMRINFRA-EQ", "NSE:GNFC-EQ", "NSE:GODREJCP-EQ", "NSE:GODREJPROP-EQ",
    "NSE:GRANULES-EQ", "NSE:GRASIM-EQ", "NSE:GUJGASLTD-EQ", "NSE:HAL-EQ", "NSE:HAVELLS-EQ",
    "NSE:HCLTECH-EQ", "NSE:HDFCBANK-EQ", "NSE:HDFCLIFE-EQ", "NSE:HEROMOTOCO-EQ", "NSE:HINDALCO-EQ",
    "NSE:HCOPPER-EQ", "NSE:HINDUNILVR-EQ", "NSE:ICICIBANK-EQ", "NSE:ICICIGI-EQ", "NSE:ICICIPRULI-EQ",
    "NSE:IDEA-EQ", "NSE:IDFCFIRSTB-EQ", "NSE:IEX-EQ", "NSE:IGL-EQ", "NSE:INDHOTEL-EQ",
    "NSE:INDIACEM-EQ", "NSE:INDIAMART-EQ", "NSE:INDIGO-EQ", "NSE:INDUSINDBK-EQ", "NSE:INDUSTOWER-EQ",
    "NSE:INFY-EQ", "NSE:IOC-EQ", "NSE:IPCALAB-EQ", "NSE:IRCTC-EQ", "NSE:ITC-EQ",
    "NSE:JINDALSTEL-EQ", "NSE:JKCEMENT-EQ", "NSE:JSWSTEEL-EQ", "NSE:JUBLFOOD-EQ", "NSE:KOTAKBANK-EQ",
    "NSE:LALPATHLAB-EQ", "NSE:LICHSGFIN-EQ", "NSE:LT-EQ", "NSE:LTIM-EQ", "NSE:LTTS-EQ",
    "NSE:LUPIN-EQ", "NSE:M&M-EQ", "NSE:M&MFIN-EQ", "NSE:MANAPPURAM-EQ", "NSE:MARUTI-EQ",
    "NSE:MCDOWELL-N-EQ", "NSE:MCX-EQ", "NSE:METROPOLIS-EQ", "NSE:MFSL-EQ", "NSE:MGL-EQ",
    "NSE:MOTHERSON-EQ", "NSE:MPHASIS-EQ", "NSE:MRF-EQ", "NSE:MUTHOOTFIN-EQ", "NSE:NATIONALUM-EQ",
    "NSE:NAVINFLUOR-EQ", "NSE:NESTLEIND-EQ", "NSE:NMDC-EQ", "NSE:NTPC-EQ", "NSE:OBEROIRLTY-EQ",
    "NSE:ONGC-EQ", "NSE:PAGEIND-EQ", "NSE:PEL-EQ", "NSE:PERSISTENT-EQ", "NSE:PETRONET-EQ",
    "NSE:PFC-EQ", "NSE:PIDILITIND-EQ", "NSE:PIIND-EQ", "NSE:PNB-EQ", "NSE:POLYCAB-EQ",
    "NSE:POWERGRID-EQ", "NSE:PVRINOX-EQ", "NSE:RAMCOCEM-EQ", "NSE:RBLBANK-EQ", "NSE:RELIANCE-EQ",
    "NSE:SAIL-EQ", "NSE:SAMMAANCAP-EQ", "NSE:SBICARD-EQ", "NSE:SBILIFE-EQ", "NSE:SBIN-EQ",
    "NSE:SHREECEM-EQ", "NSE:SHRIRAMFIN-EQ", "NSE:SIEMENS-EQ", "NSE:SRF-EQ", "NSE:SUNPHARMA-EQ",
    "NSE:SUNTV-EQ", "NSE:SYNGENE-EQ", "NSE:TATACHEMICAL-EQ", "NSE:TATACOMM-EQ", "NSE:TATACONSUM-EQ",
    "NSE:TATAMOTORS-EQ", "NSE:TATAPOWER-EQ", "NSE:TATASTEEL-EQ", "NSE:TCS-EQ", "NSE:TECHM-EQ",
    "NSE:TITAN-EQ", "NSE:TORNTPHARM-EQ", "NSE:TRENT-EQ", "NSE:TVSMOTOR-EQ", "NSE:UBL-EQ",
    "NSE:ULTRACEMCO-EQ", "NSE:UPL-EQ", "NSE:VEDL-EQ", "NSE:VOLTAS-EQ", "NSE:WIPRO-EQ",
    "NSE:ZEEL-EQ", "NSE:ZYDUSLIFE-EQ"
];
