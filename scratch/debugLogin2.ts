import puppeteer from 'puppeteer';
import { env } from '../src/config/env.ts';
import fs from 'fs';
import { fyersModel } from 'fyers-api-v3';

(async () => {
    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);
    const loginUrl = fyers.generateAuthCode();
    
    console.log("Navigating to:", loginUrl);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    try {
        const page = await browser.newPage();
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });
        
        console.log("Checking for qr button...");
        await page.evaluate(() => {
             const qrButton = document.querySelector('#login_client_id_fromQr') as HTMLButtonElement;
             if (qrButton && qrButton.offsetParent !== null) {
                  qrButton.click();
             }
        });
        await new Promise(r => setTimeout(r, 2000));
        
        console.log("Checking for #fy_client_id...");
        const exists = await page.$('#fy_client_id') !== null;
        console.log("#fy_client_id exists:", exists);
        
        const html = await page.content();
        fs.writeFileSync('scratch/dom2.html', html);
        console.log("DOM saved to scratch/dom2.html");
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
