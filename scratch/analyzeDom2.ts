import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('scratch/dom_after_submit.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

function isVisible(el: any) {
    if (!el) return false;
    let style = dom.window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.parentElement) return isVisible(el.parentElement);
    return true;
}

const otpFields = document.querySelectorAll('.otp-field');
const pinFields = document.querySelectorAll('.pin-field');

console.log("Are OTP fields visible?", Array.from(otpFields).some(e => !e.closest('[style*="display: none"]')));
console.log("Are PIN fields visible?", Array.from(pinFields).some(e => !e.closest('[style*="display: none"]')));
console.log("Is Client ID submit button disabled?", document.querySelector('#clientIdSubmit')?.hasAttribute('disabled'));

