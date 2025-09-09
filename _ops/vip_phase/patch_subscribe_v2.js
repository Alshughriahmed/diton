const fs = require('fs');
const p = 'src/app/api/stripe/subscribe/route.ts';
if (!fs.existsSync(p)) { console.log('NO_SUBSCRIBE_ROUTE'); process.exit(0); }
let t = fs.readFileSync(p,'utf8');

// 1) حقن base إن لم يوجد
if (!/const\s+base\s*=/.test(t)) {
  t = t.replace(/checkout\.sessions\.create\(\{\s*/s,
    'const base = process.env.NEXTAUTH_URL || (process.env.NEXT_PUBLIC_BASE_URL || "");\n$&');
}

// 2) ضبط success_url
if (/\bsuccess_url\s*:/.test(t)) {
  t = t.replace(/\bsuccess_url\s*:\s*(['"`])[\s\S]*?\1/s,
    'success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`');
} else {
  t = t.replace(/checkout\.sessions\.create\(\{\s*/s,
    'checkout.sessions.create({\n  success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`,\n');
}

// 3) ضبط cancel_url
if (/\bcancel_url\s*:/.test(t)) {
  t = t.replace(/\bcancel_url\s*:\s*(['"`])[\s\S]*?\1/s,
    'cancel_url: `${base}/plans`');
} else {
  t = t.replace(/success_url:[^\n]*\n/s,
    (m)=> m + '  cancel_url: `${base}/plans`,\n');
}

fs.writeFileSync(p,t);
console.log('DONE');
console.log(/\/api\/vip\/claim/.test(t)?'HAS_CLAIM=1':'HAS_CLAIM=0');
