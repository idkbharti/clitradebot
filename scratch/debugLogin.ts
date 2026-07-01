import puppeteer from 'puppeteer';
import { env } from '../src/config/env.ts';
import fs from 'fs';
import { fyersModel } from 'fyers-api-v3';

(async () => {
    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);
    const loginUrl = fyers.generateAuthCode();
    
    console.log("Fyers Login URL:", loginUrl);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    try {
        const page = await browser.newPage();
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });
        
        console.log("Page loaded. Saving DOM...");
        const html = await page.content();
        fs.writeFileSync('scratch/dom.html', html);
        console.log("DOM saved to scratch/dom.html");
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
