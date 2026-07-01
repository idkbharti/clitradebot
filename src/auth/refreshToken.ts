import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.ts';
import { saveToken, getToken } from '../core/FyersAPI.ts';

export async function refreshAccessToken() {
    console.log("🔄 Generating new Fyers Access Token headlessly...");

    // Prioritize refresh token from .env, fallback to token.json
    let refreshTokenToUse = env.FYERS_REFRESH_TOKEN;
    
    if (!refreshTokenToUse) {
        const savedData = getToken();
        if (savedData && savedData.refresh_token) {
            refreshTokenToUse = savedData.refresh_token;
        }
    }

    if (!refreshTokenToUse) {
         throw new Error("❌ No FYERS_REFRESH_TOKEN found in .env or token.json! Please run 'npm run setup' and login once via browser.");
    }
    
    if (!env.FYERS_PIN) {
         throw new Error("❌ No FYERS_PIN found in .env! It is required for the refresh token API.");
    }

    const appIdHash = crypto.createHash('sha256')
        .update(`${env.FYERS_CLIENT_ID}:${env.FYERS_SECRET_KEY}`)
        .digest('hex');

    try {
        const res = await axios.post('https://api-t1.fyers.in/api/v3/validate-refresh-token', {
            grant_type: "refresh_token",
            appIdHash: appIdHash,
            refresh_token: refreshTokenToUse,
            pin: env.FYERS_PIN
        });

        if (res.data.s === 'ok') {
            console.log("✅ Successfully generated new Access Token!");
            
            const oldData = getToken() || {};
            const newData = {
                ...oldData,
                access_token: res.data.access_token,
                refresh_token: res.data.refresh_token || refreshTokenToUse 
            };
            saveToken(newData);
            return newData;
        } else {
            throw new Error(`Failed to refresh token: ${JSON.stringify(res.data)}`);
        }
    } catch (e: any) {
        if (e.response && e.response.data) {
            throw new Error(`Fyers API Error: ${JSON.stringify(e.response.data)}`);
        }
        throw e;
    }
}
