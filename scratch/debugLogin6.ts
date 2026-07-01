import puppeteer from 'puppeteer';
import { env } from '../src/config/env.ts';
import fs from 'fs';
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
        
        // Try focusing and typing, then dispatching events
        await page.focus('#fy_client_id');
        await page.type('#fy_client_id', env.FYERS_USER_ID, { delay: 100 });
        
        await page.evaluate(() => {
            const el = document.querySelector('#fy_client_id') as HTMLInputElement;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Is Client ID submit button disabled?", await page.evaluate(() => document.querySelector('#clientIdSubmit')?.hasAttribute('disabled')));
        
        // Click the submit button
        await page.evaluate(() => {
            const btn = document.querySelector('#clientIdSubmit') as HTMLButtonElement;
            if (btn) {
                btn.removeAttribute('disabled');
                btn.click();
            }
        });
        
        console.log("Waiting 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
        
        const html = await page.content();
        fs.writeFileSync('scratch/dom_after_submit2.html', html);
        
        const visibleOTP = await page.evaluate(() => {
             const els = document.querySelectorAll('.otp-field');
             return Array.from(els).some((e: any) => e.offsetParent !== null);
        });
        console.log("Are OTP fields visible?", visibleOTP);
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
