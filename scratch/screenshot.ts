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
        await page.type('#fy_client_id', env.FYERS_USER_ID, { delay: 100 });
        
        await page.screenshot({ path: '/home/dev/.gemini/antigravity/brain/8ef0655b-4150-402a-86cf-4d0fa74f0fed/artifacts/debug.png' });
        console.log("Screenshot saved!");
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
