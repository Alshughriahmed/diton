# KNOWN_ISSUES

## مطابقة/إشارة (Signaling)
- لا يوجد خادم إشارة فعلي بعد؛ `/api/match/next` يُرجع echo للفلاتر فقط.
- زرًّا **Prev/Next** يطلقان أحداث UI ويستدعيان `/api/match/next`، لكن **لا يوجد ربط WebRTC بين طرفين** حتى تُفعَّل طبقة signaling.

## WebRTC/Media
- الواجهة تعرض **معاينة محلية** فقط؛ لن يبدأ اتصال حقيقي بدون signaling.
- يتطلب الإنتاج HTTPS + ترويسة `Permissions-Policy: camera=(self), microphone=(self)` (ثُبّتت على Vercel).
- يلزم موافقة المتصفح يدويًا على الكاميرا/المايك.

## Rate Limiting
- تطبيق بسيط بذاكرة العملية (in-memory). على بيئات عدّة نسخ/Serverless لن تتشارك العدّادات.
- يُستحسن Redis لاحقًا.

## CSP/Headers
- سياسة **CSP متساهلة للتطوير** (`unsafe-inline/unsafe-eval`). شدّدها للإنتاج عند الاستقرار.
- لا تُضيف هيدرز متعارضة في `middleware.ts`؛ مصدر الحقيقة في `next.config.mjs`.

## Age Gate
- البوابة تعتمد كوكي `ageok=1` مع `SameSite=Lax`. سكربتات الفحص الآلي قد تُخطئ إن لم تُمرَّر الكوكي.

## VIP/DB/Prisma
- VIP يعمل بالكوكي dev فقط (`vip=1`). لا تكامل DB بعد.
- Prisma اختياري؛ لا يجري `prisma generate` بالإنتاج حاليًا.

## TURN/STUN
- endpoint `GET /api/ice` يقرأ مفاتيح البيئة (`TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`, …).
- بدون إعداد مفاتيح صحيحة، سيقتصر الأمر على STUN/معاينة محلية.

## CSS/Tailwind/Vercel
- تم توحيد ESM فقط (`postcss.config.js`, `tailwind.config.js`) واستيراد `./globals.css` في `src/app/layout.tsx`.
- أي Build Overrides على Vercel قد تسبب **صفحات بلا CSS**؛ يجب ترك الإعدادات الافتراضية.

## واجهة المستخدم
- عدّادات Like/إعجاب، قائمة الأصدقاء، الإبلاغ، وبعض أزرار الإعدادات **واجهات فقط** (وضع Placeholder) بانتظار الطرف الخلفي.
- قائمة الدول تعتمد ملف بيانات محلّي؛ ترجمة/RTL لاحقًا.

## اختبارات/مراقبة
- لا يوجد مراقبة سحابية/Telemetry بعد. لا توجد E2E كاملة؛ نعتمد Acceptance Blocks.
