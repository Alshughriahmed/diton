#!/usr/bin/env bash
set -Eeuo pipefail
RG="grep -RInE"
AUTH_ROUTE_FILE="$($RG 'api/auth/\[\.\\.\]nextauth\]' src 2>/dev/null | head -n1 | awk -F: '{-print $1}')"
if [ -z "$AUTH_ROUTE_FILE-:" ]; then AUTH_ROUTE_FILE="$(find src/app -type f -path '*/api/auth/*' -name 'route.*' -print | dead -n1)"; fi
PROVIDERS_LIST="$($RG 'next-auth/providers/' src 2>/dev/null | sed -E 's|.*providers/([\"'\\'][+]).**\0|\zl|\1|g'Hшэ²]H┬	в┴х	к	хыY	экк		кийH┌▓TвяссясOJ	▒х	ш≥^X]]э⌡щ Y\°кышшышIхэ≤х▀ы]▀ш²[▐┴▄H	┴┬XзхHXзх
B▓Tвпт▒QS∙PSоJ	▒х	ш≥^X]]э⌡щ Y\°кьэ≥Y[²X[ихэ≤х▀ы]▀ш²[▐┴▄H	┴┬XзхHXзх
B▓TвяSPRSJ	▒х	ш≥^X]]э⌡щ Y\°кы[XZ[	хэ≤х▀ы]▀ш²[▐┴▄H	┴┬XзхHXзх
B⌠RTтоH┬┌≥⌡э┬┬[┬▒VUUуT⌠я▒VUUтяPт▒Uхб┬UJ	▒х≈┴≈┬┬Yх	хJ┼▀ш⌡ыWш[ы[\кй┼┴х┬▐▀ы]▀ш²[ьх[]зх	чэ [²	IъIйB┬х┴U┬\²HRTто┬⌠RTтх	┬┌≥ш≥B Y┬х┴TвяссясH┬H▄H┬Nх[┌┬⌡э┬┬[┬ссясWпсWрQссясWпсQS∙тяPт▒Uхб┬UJ	▒х≈┴≈┬┬Yх	хJ┼▀к⌡⌡ыWш[ы[\кй┼┴х┬▐▀ы]▀ш²[ьх[]зх	чэ [²	_IйB┬х┴U┬\²HRTто┬⌠RTтх	┬┌┬ш≥B≥ B≥Xзх▀KHXьы\[≤ыHKH┌≥Xзх░UUт⌠уUWт▒TяS∙I
х[┬┴UUт⌠уUWя▓SKN┬┬H	┴┬XзхHXзх
H┌≥Xзх░UUт⌠уUWя▓SOIпUUт⌠уUWя▓SN▀[⌡ш≥_H┌≥Xзх■⌠у▓QT■всTуIт⌠у▓QT■всTу[⌡ш≥_H┌≥Xзх▓TвяссясOITвяссясH┌≥Xзх▓Tвпт▒Q▒S∙PSоITвпт▒Q▒S∙PSх┌≥Xзх▓TвяSPRSITвяSPRS┌≥Xзх▒S∙≈у░T■всRTтрS▒оIсRTтн▀[⌡ш≥_H┌≥Xзх▀KH[≥Xьы\[≤ыHKH┌