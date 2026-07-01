import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { env } from '../src/config/env.ts';
import { fyersModel } from 'fyers-api-v3';

puppeteer.use(StealthPlugin());

(async () => {
    const fyers = new fyersModel();
    fyers.setAppId(env.FYERS_CLIENT_ID);
    fyers.setRedirectUrl(env.FYERS_REDIRECT_URI);
    const loginUrl = fyers.generateAuthCode();

    const browser = await puppeteer.launch({
        headless: 'new' as any,
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
        
        await page.type('#fy_client_id', env.FYERS_USER_ID, { delay: 100 });
        
        console.log("Waiting 3 seconds for Turnstile to resolve...");
        await new Promise(r => setTimeout(r, 3000));
        
        console.log("Is Client ID submit button disabled?", await page.evaluate(() => document.querySelector('#clientIdSubmit')?.hasAttribute('disabled')));
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
