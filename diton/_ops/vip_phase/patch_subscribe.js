const fs = require('fs');
const path = 'src/app/api/stripe/subscribe/route.ts';
if (!fs.existsSync(path)) { console.log('NO_SUBSCRIBE_ROUTE'); process.exit(0); }
let txt = fs.readFileSync(path, 'utf8');

// base ثابت: NEXTAUTH_URL
if (!/const\s+base\s*=/.test(txt)) {
  txt = txt.replace(/checkout\.sessions\.create\(\{\s*/s, match => `const base = process.env.NEXTAUTH_URL || ""; \n${match}`);
}

const newSuccess = 'success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`';
const newCancel  = 'cancel_url: `${base}/plans`';

txt = txt.replace(/success_url:\s*(['"`]).*?\1/s, newSuccess);
txt = txt.replace(/cancel_url:\s*(['"`]).*?\1/s, newCancel);

fs.writeFileSync(path, txt);
console.log('PATCHED_SUBSCRIBE');
