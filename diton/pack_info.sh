#!/usr/bin/env bash
set -euo pipefail
jq -s '.[0] * .[1]' _repo_snapshot.json _prod_snapshot.json | tee _final_packet.json
echo "-----BEGIN-DITONACHAT-PACKET-----"
base64 -w0 _final_packet.json
echo
echo "-----END-DITONACHAT-PACKET-----"
