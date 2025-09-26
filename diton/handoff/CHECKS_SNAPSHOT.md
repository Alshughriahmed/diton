Verification Snapshot (local dev)
Results (from your shell outputs)

Health: GET /api/health → 200

Permissions-Policy on /chat (with age cookie): camera=(self), microphone=(self)

CSS: link present · Content-Type: text/css; charset=UTF-8 · Tailwind utilities found

VIP status:

Anonymous: {"isVip":false,"via":"anon"}

With vip=1 cookie: {"isVip":true,"via":"cookie"}

Match/Next sample:
{"ts":<number>,"gender":"female","countries":["US","DE"]}

Commands used (for reproducibility)
# Health
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health

# Age cookie + header check
COOKIE=/tmp/c.txt; :> "$COOKIE"
curl -s -X POST -c "$COOKIE" http://127.0.0.1:3000/api/age/allow >/dev/null
curl -s -I -b "$COOKIE" http://127.0.0.1:3000/chat | grep -i '^Permissions-Policy:'

# CSS + utilities
css=$(curl -s http://127.0.0.1:3000/ | grep -oE "/_next/static/css/[^\"]+\.css" | head -1)
[ -n "$css" ] && curl -sI "http://127.0.0.1:3000$css" | grep -i '^Content-Type:'
curl -s http://127.0.0.1:3000/ | grep -Eq "min-h-screen|bg-gradient-to-b" && echo "UTIL:found" || echo "UTIL:missing"

# VIP + match
curl -s http://127.0.0.1:3000/api/user/vip-status
curl -s -H "Cookie: vip=1" http://127.0.0.1:3000/api/user/vip-status
curl -s "http://127.0.0.1:3000/api/match/next?gender=female&countries=US,DE"

Notes

لفحص تدفق العمر كاملًا: تأكد أن أول طلب إلى /chat بلا كوكي يعيد 307، ثم بعد POST /api/age/allow يصبح /chat → 200.

Acceptance
-- Acceptance --
HEALTH=200
PERMISSIONS_POLICY="camera=(self), microphone=(self)"
CSS_LINK=present CONTENT_TYPE=text/css UTILITIES=found
VIP_PRE={"isVip":false,"via":"anon"}
VIP_POST={"isVip":true,"via":"cookie"}
MATCH_SAMPLE=ok
-- End Acceptance --
