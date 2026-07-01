import puppeteer from 'puppeteer';
import { env } from '../src/config/env.ts';
import { fyersModel } from 'fyers-api-v3';

(async () => {
    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);
    const loginUrl = fyers.generateAuthCode();

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    try {
        const page = await browser.newPage();
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => {
            const rb = document.querySelector('#clientId_rb') as HTMLInputElement;
            if (rb) rb.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        
        const isClientVisible = await page.evaluate(() => document.querySelector('#fy_client_id')?.offsetParent !== null);
        const isPanVisible = await page.evaluate(() => document.querySelector('#pan_or_yob')?.offsetParent !== null);
        
        console.log("Is Client ID visible?", isClientVisible);
        console.log("Is PAN visible?", isPanVisible);
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
