import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('scratch/dom_after_submit.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const scripts = document.querySelectorAll('script');
scripts.forEach((s, i) => {
    if (s.src) console.log(`Script ${i}: ${s.src}`);
    else if (s.textContent?.includes('clientIdSubmit')) console.log(`Inline Script ${i} matches clientIdSubmit`);
});

