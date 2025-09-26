set -euo pipefail
BASE="${1:-https://www.ditonachat.com}"
echo "BASE=$BASE"
echo "== metrics env =="
curl -fsS "$BASE/api/monitoring/metrics"; echo
echo "== acc_full =="
bash _ops/acc_full.sh "$BASE"
