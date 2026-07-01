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
        
        const visibleElements = await page.evaluate(() => {
            const getVisible = (selector: string) => {
                const els = document.querySelectorAll(selector);
                const vis = Array.from(els).filter((e: any) => e.offsetParent !== null).map(e => e.id || e.className || e.tagName);
                return vis;
            };
            return {
                buttons: getVisible('button'),
                inputs: getVisible('input')
            };
        });
        
        console.log("Visible Buttons:", visibleElements.buttons);
        console.log("Visible Inputs:", visibleElements.inputs);
        
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
