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
        
        console.log("Clicking #clientId_rb");
        await page.evaluate(() => {
            const rb = document.querySelector('#clientId_rb') as HTMLInputElement;
            if (rb) rb.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Typing Client ID:", env.FYERS_USER_ID);
        await page.type('#fy_client_id', env.FYERS_USER_ID, { delay: 50 });
        
        await new Promise(r => setTimeout(r, 1000));
        console.log("Clicking submit");
        await page.evaluate(() => {
            const btn = document.querySelector('#clientIdSubmit') as HTMLButtonElement;
            if (btn) btn.click();
        });
        
        console.log("Waiting 5 seconds for next screen...");
        await new Promise(r => setTimeout(r, 5000));
        
        const html = await page.content();
        fs.writeFileSync('scratch/dom_after_submit.html', html);
        console.log("DOM saved to scratch/dom_after_submit.html");
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
