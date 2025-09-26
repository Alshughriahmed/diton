# START_HERE

مرحبًا! هذا المستودع هو **DitonaChat**: دردشة فيديو عشوائية 18+ مع فلاتر (الدول/الجنس) ومسار VIP.  
هدف هذا الملف: إرشاد المساعد الجديد ليبدأ بسرعة وبثقة **بدون تعديل الكود**.

---

## ماذا يفعل المشروع باختصار
- Next.js 15 (App Router) + React 19 + TypeScript.
- Tailwind/PostCSS (ESM فقط) مع `globals.css` مستورد في `layout.tsx`.
- حماية `/chat` بـ **Age Gate** (كوكي `ageok=1`).
- ترويسات الأمان من **مصدر واحد**: `next.config.mjs`، وأهمها:
  - `Permissions-Policy: camera=(self), microphone=(self)`
- واجهة `/chat` مقسومة 50/50، شريط فلاتر (دول/جنس)، أدوات المستخدم، Prev/Next مع تبريد ~700ms.
- مسارات API أساسية: health, age/allow, user/vip-status, match/next, ice.

---

## كيف تبدأ القراءة (الترتيب الموصى به)
1) `handoff/SUMMARY_PERMA_v1.md` — الصورة الكبيرة والقرارات الثابتة.  
2) `plan1.md` — المواصفات/التخطيط المرئي والسلوكي.  
3) `next.config.mjs` + `middleware.ts` — مصدر الهيدرز وAge Gate.  
4) `postcss.config.js`, `tailwind.config.js`, `src/app/globals.css`, `src/app/layout.tsx` — خط CSS.  
5) `src/app/chat/ChatClient.tsx` + `src/hooks/*` + `src/utils/*` — الواجهة والتفاعل.  
6) `src/app/api/*` — نقاط الـAPI وحالتها الفعلية.

> لا تُجري تعديلات قبل إكمال الفهم 100% وإرسال فحص "قراءة فقط".

---

## ما الذي يجب تسليمه في أول رد
- **تأكيد فهم كامل 100%** للنقاط الأساسية أعلاه (بدون تخمين).  
- **دفعة أوامر فحص "قراءة فقط"** (لا تغييرات بالكود) وتشمل:  
  - طباعة إصدارات Node/pnpm.  
  - تثبيت آمن بدون تغييرات.  
  - فحص وجود توجيهات Tailwind.  
  - تشغيل dev على المنفذ (PORT أو 3000) وإظهار عنوان فحص الصحة.  
  - إيقاف السيرفر.  
  - **Acceptance Block** قصير يؤكد نجاح الفحص.
- **فروقات واضحة** بين الكود و`plan1.md` إن وُجدت (ملف `handoff/DIFF_PLAN.md`).

---

## قواعد ثابتة أثناء العمل
- لا أسرار في Git (الأسماء فقط في `handoff/ENV_USED_KEYS.txt`).  
- مصدر ترويسات الأمان = `next.config.mjs` فقط.  
- دفعات Shell دائمًا `set -Eeuo pipefail` + **قبول واضح** بنهاية كل دفعة.  
- خطوات كبيرة: **Backup → Apply → Verify → Report** داخل `_ops/`.

---

## نقاط يجب التأكد منها مبكرًا
- `/api/health` يعمل محليًا.  
- `/chat` يُعيد 307 بدون كوكي عمر → بعد `POST /api/age/allow` يصبح 200.  
- الهيدر على `/chat`: `Permissions-Policy: camera=(self), microphone=(self)`  
- وجود رابط CSS في الصفحة الرئيسية وContent-Type= `text/css`.  
- `vip-status` قبل/بعد كوكي `vip=1` يتبدّل `via`.

---

## عند الحاجة لأسئلة
- استخدم ملف `handoff/KNOWN_ISSUES.md` لتوثيق أي قيود أو أسئلة مفتوحة.  
- لا تُدخل تغييرات وظيفية قبل اتفاق صريح.

