const fs = require("fs");
const f = process.argv[2];
let s = fs.readFileSync(f, "utf8");
let patched = 0;

// بعد تعيين المرجع إلى dc
if (!/__ditonaDataChannel2\s*=\s*dc/.test(s) && /__ditonaDataChannel\s*=\s*dc/.test(s)) {
  s = s.replace(/(__ditonaDataChannel\s*=\s*dc\s*;)/, `$1\n      (globalThis as any).__ditonaDataChannel2 = dc;`);
  patched = 1;
}

// بعد الإلغاء إلى null
if (!/__ditonaDataChannel2\s*=\s*null/.test(s) && /__ditonaDataChannel\s*=\s*null/.test(s)) {
  s = s.replace(/(__ditonaDataChannel\s*=\s*null\s*;)/, `$1\n      (globalThis as any).__ditonaDataChannel2 = null;`);
  patched = 1;
}

if (patched) fs.writeFileSync(f, s);
console.log(JSON.stringify({ patched }));
