# RTC Idempotency & ICE Grace Headers (client → server)

- `x-pair-id`: معرّف الزوج الحالي.
- `x-rtc-role`: caller | callee.
- `x-sdp-tag`: بصمة SDP قصيرة (UUID أو hash) لكل عرض/قبول.
- `x-anon-id`: هوية مجهولة ثابتة للعميل.
- `x-last-stop-ts`: طابع زمني (ms) لآخر Next/Stop، يستخدم لمهلة ICE Grace ≤5s.

هذه القيم ستُفعّل لاحقًا عندما نربط الواجهات تحت FLAGS.
