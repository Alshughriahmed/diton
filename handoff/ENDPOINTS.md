# ENDPOINTS

> أمثلة الإنتاج تستخدم: https://diton.vercel.app  
> أمثلة المحلي تستخدم: http://127.0.0.1:3000

## Pages
- **GET /** → الصفحة الرئيسية (RSC)
- **GET /plans** → صفحة الخطط
- **GET /chat** → صفحة الدردشة (محميّة بـ ageok=1 عبر Middleware)

## Health
- **GET /api/health** → `{ ok: true, ts }`
  - محلي: `curl -s http://127.0.0.1:3000/api/health`
  - إنتاج: `curl -s https://diton.vercel.app/api/health`

## Age Gate
- **POST /api/age/allow** → يضبط كوكي `ageok=1` لسنة
  - مثال: 
    - `curl -s -X POST -c /tmp/c.txt http://127.0.0.1:3000/api/age/allow`
    - ثم: `curl -s -I -b /tmp/c.txt http://127.0.0.1:3000/chat`

## VIP Status
- **GET /api/user/vip-status** → `{ isVip, via: "anon"|"cookie"|"db" }`
  - بدون كوكي: `curl -s http://127.0.0.1:3000/api/user/vip-status`
  - مع كوكي dev: `curl -s -H "Cookie: vip=1" http://127.0.0.1:3000/api/user/vip-status`

## Match / Next
- **GET /api/match/next?gender=<all|male|female|couple|lgbt>&countries=US,DE**
- **POST /api/match/next**  Body JSON: `{ gender, countries }`
  - يسترجع Echo: `{ ts, gender, countries[] }`
  - مثال: `curl -s "http://127.0.0.1:3000/api/match/next?gender=female&countries=US,DE"`

## ICE (TURN/STUN)
- **GET /api/ice** → `{ iceServers: [...] }` (يستخدم مفاتيح البيئة إن وُجدت)
  - مثال: `curl -s http://127.0.0.1:3000/api/ice`

## Headers مهمة
- على `/chat` يجب أن يظهر:
  - `Permissions-Policy: camera=(self), microphone=(self)`
  - تحقق محليًا:
    ```bash
    curl -s -X POST -c /tmp/c.txt http://127.0.0.1:3000/api/age/allow >/dev/null
    curl -s -I -b /tmp/c.txt http://127.0.0.1:3000/chat | grep -i "^Permissions-Policy:"
    ```

## Rate Limiting (إنفاذ خفيف)
- مطبّق على بعض مسارات الـAPI (قيم نموذجية: age/allow 12req/min، match/vip 60req/min).
- الاستجابة عند التقييد: `429 { ok:false, rate_limited:true, reset }`.

