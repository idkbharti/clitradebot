import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('scratch/dom_after_submit.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const scripts = document.querySelectorAll('script');
console.log(scripts[15].textContent?.substring(0, 500));
console.log("\n-----------------\n");
console.log(scripts[17].textContent?.substring(0, 1000));
