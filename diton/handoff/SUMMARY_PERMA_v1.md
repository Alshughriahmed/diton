# الملخص الدائم v1

## الحالة الحالية
- المشروع: **DitonaChat** (دردشة فيديو عشوائية 18+ مع فلاتر دول/جنس ومسار VIP).
- الحالة: جاهز قبل النشر. CSS/Tailwind يعمل، Age Gate يعمل، الهيدر **Permissions-Policy: camera=(self), microphone=(self)** مضبوط.
- التطوير محليًا يعمل، والـAPI الأساسية موجودة.

## البنية والملفات الحرجة
- **Next.js 15 (App Router)** + **React 19** + **TypeScript**.
- **Tailwind/PostCSS**: ESM فقط  
  - `postcss.config.js`، `tailwind.config.js`  
  - `src/app/globals.css` مستوردة في `src/app/layout.tsx`.
- **Middleware**: `middleware.ts` لحماية `/chat` بكوكي `ageok=1`.
- **Security Headers**: مضبوطة عبر `next.config.mjs` (المصدر الوحيد للهيدرز).
- **APIs**:
  - `GET /api/health` → `{ ok: true, ts }`
  - `POST /api/age/allow` → يضبط `ageok=1`
  - `GET /api/user/vip-status` → `{ isVip, via: "anon"|"cookie"|"db" }`
  - `GET/POST /api/match/next` → echo للفلاتر `{ ts, gender, countries[] }`
  - `GET /api/ice` → قائمة STUN/TURN من ENV (إن وُجدت)
- **واجهة /chat**: 50/50 (علوي الطرف المقابِل / سفلي المستخدم)، شريط فلاتر، أدوات المستخدم، Prev/Next مع **cooldown ~700ms**، اختصارات لوحة مفاتيح.

## القرارات الثابتة
- عدم مزج `.cjs/.mjs` في Tailwind/PostCSS (ESM فقط).
- مصدر واحد للهيدرز: **next.config.mjs** (لا كتابة هيدرز في middleware).
- **Age Gate** محدود على `/chat` فقط.
- عدم إلزام مفاتيح Auth/Stripe/DB في البناء (تعمل اختياريًا).
- عدم تخزين أسرار في Git. المفاتيح عبر ENV فقط.

## قواعد العمل الثابتة
- دفعات Shell دائمًا: `set -Eeuo pipefail` + قبول واضح بنهاية كل دفعة.
- تشغيل dev على `$PORT` أو 3000.
- لا تغييرات خطِرة دون **Backup → Apply → Verify → Report** داخل `_ops/`.
- توثيق أي تعديل في `_ops/reports/`.

## المهام المفتوحة/المغلقة
- **مغلقة**: CSS على Vercel، تكرار استيراد `globals.css`، توحيد الهيدرز، مسار الصحة، إعدادات ESM، تبريد Prev/Next.
- **مفتوحة**: إشارة/WebRTC حقيقية (Socket/Signaling)، ربط VIP بقاعدة بيانات فعلية، تحسين CSP للإنتاج، مراقبة سحابية، i18n.

## روابط دائمة
- GitHub: https://github.com/Alshughriahmed/diton
- الخطة: `plan1.md` (جذر المستودع)
- Health (إنتاج): https://diton.vercel.app/api/health (قد تختلف حسب البيئة)
- صفحة الدردشة: `/chat`

