#!/usr/bin/env bash
set -euo pipefail
BASE="https://www.ditonachat.com"
curl -s "$BASE/api/turn" | jq '{servers:(.iceServers|length), tcp443:([.iceServers[].urls]|flatten|map(tostring)|map(contains(":443"))|any), hasCredential:(.iceServers[]?|select((.urls|tostring)|contains(":443"))|has("credential"))}'
