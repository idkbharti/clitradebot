import axios from 'axios';
import { env } from '../src/config/env.ts';
import crypto from 'crypto';

(async () => {
    try {
        console.log("Testing validate-refresh-token API...");
        const appIdHash = crypto.createHash('sha256').update(`${env.FYERS_CLIENT_ID}:${env.FYERS_SECRET_KEY}`).digest('hex');
        
        const res = await axios.post('https://api-t1.fyers.in/api/v3/validate-refresh-token', {
            grant_type: "refresh_token",
            appIdHash: appIdHash,
            refresh_token: "dummy_token_to_check_endpoint_exists",
            pin: env.FYERS_PIN
        });
        
        console.log("Response:", res.data);
    } catch (e: any) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
})();
