#!/usr/bin/env bash
set -euo pipefail
events_json=$(jq -n --rawfile ev "_repo_events_map.txt" '{repo_events:$ev}')
buttons_json=$(jq -n --rawfile bt "_repo_buttons_map.txt" '{repo_buttons:$bt}')
prod_extra_json=$(jq -n --rawfile ps "_prod_smoke_extra.txt" '{prod_smoke_extra:$ps}')
bundles_json=$(jq -n --rawfile bg "_prod_bundle_grep.txt" '{prod_bundle_grep:$bg}')
jq -s '.[0] * .[1] * .[2] * .[3] * .[4] * .[5]' \
  _repo_snapshot.json _prod_snapshot.json \
  <(echo "$events_json") <(echo "$buttons_json") \
  <(echo "$prod_extra_json") <(echo "$bundles_json") \
  | tee _final_packet_v3.json
echo "-----BEGIN-DITONACHAT-PACKET-V3-----"
base64 -w0 _final_packet_v3.json
echo
echo "-----END-DITONACHAT-PACKET-V3-----"
