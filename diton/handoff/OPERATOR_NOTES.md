
# OPERATOR NOTES — DitonaChat

> وثيقة تشغيل للمساعد/المهندس التالي. لا تُجري تغييرات قبل قراءة هذا الملف مع `handoff/START_HERE.md` و`handoff/RUNBOOK.md`.

---

## 1) البيئة وحقائق ثابتة
- **Node.js:** 20.x  
- **Next.js:** 15 (App Router)  
- **Package manager:** pnpm (لدينا `pnpm-lock.yaml`)  
- **Port dev:** `PORT=3000` (يمكن تغييره بمتغير بيئة)  
- **الريبو يعمل في Replit**؛ شِل (bash) متاح. لدينا وكيل Replit Agent يمكن تشغيله لتنفيذ دفعات أوامر، لكن نستخدمه بحذر حفاظًا على التكلفة.

### مسارات مهمة
- صفحات الدردشة: `src/app/chat/ChatClient.tsx`
- الميدلوير (بوابة العمر فقط): `middleware.ts` (جذر المشروع)
- الرؤوس الأمنية: `next.config.mjs` (هو **مصدر الحقيقة** لـ headers)
- API:
  - `/api/health` : فحص صحة
  - `/api/age/allow` : يضبط `ageok=1`
  - `/api/user/vip-status` : VIP (كوكي `vip=1`)
  - `/api/match/next` : واجهة match (GET/POST)
  - `/api/ice` : إعدادات STUN/TURN (تقرأ من ENV عند توفرها)
- Tailwind/PostCSS (ESM فقط):  
  `tailwind.config.js`, `postcss.config.js`  
  استيراد الـCSS في `src/app/layout.tsx` بسطر واحد: `import "./globals.css"`

---

## 2) طريقة التشغيل والاختبار (قراءة فقط)
> لا تُعدّل شيئًا لتشغيل الفحوص. استخدم الأوامر كمرجع.

- تثبيت:
  ```bash
  pnpm install --frozen-lockfile || pnpm install
````

* تشغيل dev:

  ```bash
  PORT=3000 pnpm dev
  ```
* فحص الصحة:

  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health
  ```
* تدفق العمر + الهيدر (Permissions-Policy):

  ```bash
  COOKIE=/tmp/c.txt; :> "$COOKIE"
  curl -s -X POST -c "$COOKIE" http://127.0.0.1:3000/api/age/allow >/dev/null
  curl -s -I -b "$COOKIE" http://127.0.0.1:3000/chat | grep -i '^Permissions-Policy:'
  # يجب أن تكون: camera=(self), microphone=(self)
  ```
* CSS/Tailwind يتحمّل:

  ```bash
  css=$(curl -s http://127.0.0.1:3000/ | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
  [ -n "$css" ] && curl -sI "http://127.0.0.1:3000$css" | grep -i '^Content-Type:'
  ```
* VIP:

  ```bash
  curl -s http://127.0.0.1:3000/api/user/vip-status
  curl -s -H "Cookie: vip=1" http://127.0.0.1:3000/api/user/vip-status
  ```

**قالب قبول بعد أي فحص:**

```
-- Acceptance --
HEALTH=200
AGE_FLOW=ok
PERMISSIONS_POLICY=camera(self),mic(self)
CSS_LINK=ok
VIP=pre:200 post:200
NO_CODE_CHANGES=1
-- End Acceptance --
```

---

## 3) سياسات عمل ثابتة

* **Idempotent:** أي سكربت يُشغَّل عدة مرات بدون إفساد الشجرة.
* **لا أسرار في Git:** نذكر أسماء المفاتيح فقط (انظر `handoff/ENV_USED_KEYS.txt`).
* **مصدر واحد للرؤوس:** `next.config.mjs`. لا تكتب headers في `middleware.ts`.
* **الحد الأدنى من التكلفة:** استعمل الوكيل فقط عند الحاجة وبدفعات موجهة وواضحة.
* **القبول دائمًا:** اختم أي دفعة بف块 قبول مثل أعلاه.

---

## 4) استخدام Replit Shell vs. Replit Agent

* **Shell:** مفضل للفحوص واللمسات الصغيرة. انتبه لـ heredocs (استخدم إغلاق صحيح `<<'EOF'`).
* **Agent:** استخدمه عندما تحتاج دفعة عمليات طويلة أو متعددة الملفات.
  تعليمات للوكيل:

  * اعمل داخل جذر المشروع فقط (`/home/runner/workspace`).
  * خذ نسخة احتياطية إلى `_ops/backups/<stamp>/` قبل أي تعديل.
  * لا تغيّر المنطق الأمني دون سبب.
  * أنهِ كل مهمة بتقرير و**Acceptance Block** واضح.

---

## 5) أعطال شائعة وكيفية تشخيصها

* **اختفاء تصميم على Vercel:** تأكد أن البناء يتم بـ `pnpm run build` وأن ملفات Tailwind/PostCSS بصيغة ESM فقط ولا وجود لنسخ `.cjs`.
* **هيدر الكاميرا/المايك خاطئ:** تحقق أنه لا يوجد `src/middleware.ts` ثانٍ، وأن `next.config.mjs` يضبط:

  ```
  Permissions-Policy: camera=(self), microphone=(self)
  ```
* **Dev لا يبدأ بسبب الأعلام:** مرر المنفذ عبر `PORT` بدل تمرير `-p` لأوامر `pnpm dev`.
* **أخطاء import لمسار معدل الإرسال (ratelimit):** تأكد من المسار الصحيح لـ `src/lib/ratelimit.ts` إن وُجد.

---

## 6) ما الذي نملكه الآن (ملخص سريع)

* واجهة دردشة 50/50 (قسم علوي للقرين/سفلي للمستخدم).
* أزرار Prev/Next + إيماءات (Cooldown \~700ms).
* شريط أدوات سفلي، فلاتر الجنس/الدول، إدخال رسائل + Emoji placeholder.
* API جاهزة: health/age/vip/match/ice.
* هيدر الكاميرا/المايك مضبوط كما ينبغي.
* لا توجد إتصالات WebRTC حقيقية بعد (تتطلب تفعيل signaling + TURN/STUN production).

---

## 7) كيف تطلب الملفات أو الفحوص

* اطلب **نص الملف كاملًا** عند الحاجة (سنزوّدك به فورًا).
* أو اطلب تشغيل أوامر فحص محددة ونعيد لك المخرجات.
* إن احتجت تعديلات: قدم سكربتات idempotent فقط، مع نسخ احتياطية إلى `_ops/backups/`.

---

## 8) خارطة الطريق القريبة (بدون تنفيذ تلقائي)

* Signaling (WebSocket/Socket.IO) + ربط `media.ts` للحصول على فيديو حي.
* تفعيل TURN باستخدام ENV (مفاتيح موجودة على Vercel؛ لا تُنشر في Git).
* تحسينات إمكانية الوصول/الترجمة/الأناليتكس بعد الإطلاق.

```
```
