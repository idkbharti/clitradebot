import fs from 'fs';
const html = fs.readFileSync('scratch/dom_after_submit.html', 'utf8');

// Find visible errors
const errorMatches = html.match(/<[^>]*class="[^"]*error[^"]*"[^>]*>([^<]*)<\//g);
if (errorMatches) console.log("Errors:", errorMatches);

// Find otp fields
const otpFields = html.match(/otp-field/g);
console.log("otp-field count:", otpFields ? otpFields.length : 0);

const pinFields = html.match(/pin-field/g);
console.log("pin-field count:", pinFields ? pinFields.length : 0);

// Print any div that looks like a form error
const allErrors = [...html.matchAll(/class="[^"]*text-danger[^"]*"[^>]*>([^<]+)</gi)];
if (allErrors.length > 0) console.log("Danger texts:", allErrors.map(m => m[1]));
