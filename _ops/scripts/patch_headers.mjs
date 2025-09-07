import fs from 'fs';

const p = 'next.config.mjs';
let src = '';
try { src = fs.readFileSync(p,'utf8'); } catch { src=''; }

const hdrBlock = `
export async function headers() {
  return [
    {
      source: '/chat/:path*',
      headers: [
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self)' }
      ]
    }
  ];
}
`.trim();

if (!src) {
  // ملف غير موجود: أنشئ config جديد بالهيدر فقط
  fs.writeFileSync(p, hdrBlock + '\n');
  process.exit(0);
}

if (/export\s+async\s+function\s+headers\s*\(/.test(src)) {
  // استبدال جسم الدالة الحالية بالكامل
  src = src.replace(/export\s+async\s+function\s+headers\s*\([\s\S]*?\}\s*\}/, hdrBlock);
} else {
  // ألصق الدالة في النهاية بدون لمس الإعدادات الأخرى
  src = src.trimEnd() + '\n\n' + hdrBlock + '\n';
}

fs.writeFileSync(p, src);
console.log('headers() patched');
