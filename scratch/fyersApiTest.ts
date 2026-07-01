import axios from 'axios';
import { env } from '../src/config/env.ts';
import { TOTP } from 'totp-generator';

(async () => {
    try {
        console.log("Sending OTP request to Fyers internal API...");
        const res1 = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', {
            fy_id: env.FYERS_USER_ID,
            app_id: "2" // Fyers Web uses app_id: 2
        });
        
        console.log("Step 1 response:", res1.data);
        const requestId = res1.data.request_key;
        
        const totpData = await TOTP.generate(env.FYERS_TOTP_SECRET);
        const token = totpData.otp;
        
        console.log("Sending TOTP...");
        const res2 = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', {
            request_key: requestId,
            otp: token
        });
        console.log("Step 2 response:", res2.data);
        
        const res3 = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', {
            request_key: res2.data.request_key,
            identity_type: "pin",
            identifier: Buffer.from(env.FYERS_PIN).toString('base64') // Or just plain?
        });
        console.log("Step 3 response:", res3.data);
        
    } catch (e: any) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
})();
