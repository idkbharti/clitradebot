import puppeteer from 'puppeteer';
import { env } from '../src/config/env.ts';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    try {
        const page = await browser.newPage();
        await page.goto(`https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${env.FYERS_CLIENT_ID}&redirect_uri=http://127.0.0.1:5000/auth/callback&response_type=code&state=sample_state`, { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => {
            const rb = document.querySelector('#clientId_rb') as HTMLInputElement;
            if (rb) rb.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        
        // React bypass
        await page.evaluate((userId) => {
            const el = document.querySelector('#fy_client_id') as HTMLInputElement;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            nativeInputValueSetter?.call(el, userId);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, env.FYERS_USER_ID);
        
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Is Client ID submit button disabled?", await page.evaluate(() => document.querySelector('#clientIdSubmit')?.hasAttribute('disabled')));
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
