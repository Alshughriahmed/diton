
#!/usr/bin/env bash
set -Eeuo pipefail
set +H
export TERM=dumb

echo "Starting P4 API Policy Deduplication at $(date)"

# Create backup directory
UTC=$(date -u '+%Y%m%d-%H%M%S')
BACKUP_DIR="_ops/backups/${UTC}"
mkdir -p "${BACKUP_DIR}"

# Find target route files
TARGET_PATTERN='src/app/api/{rtc,message,like,user}/**/route.ts'
mapfile -t ROUTE_FILES < <(find src/app/api -name 'route.ts' -path '*/rtc/*' -o -name 'route.ts' -path '*/message/*' -o -name 'route.ts' -path '*/like/*' -o -name 'route.ts' -path '*/user/*' | sort)

TOTAL_FILES=${#ROUTE_FILES[@]}
FILES_CHANGED=0
ROUTES_HARDENED=0
SMOKE_PASS=true

echo "Found ${TOTAL_FILES} target route files"

for file in "${ROUTE_FILES[@]}"; do
    echo "Processing: ${file}"
    
    # Create backup
    cp "${file}" "${BACKUP_DIR}/$(basename "${file}").$(echo "${file}" | tr '/' '_')"
    
    # Work on temp file
    TEMP_FILE=$(mktemp)
    cp "${file}" "${TEMP_FILE}"
    
    CHANGED=false
    
    # Remove duplicate dynamic exports (keep first)
    if [ "$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+dynamic[[:space:]]*=' "${TEMP_FILE}")" -gt 1 ]; then
        echo "  Removing duplicate dynamic exports"
        awk '
        /^[[:space:]]*export[[:space:]]+const[[:space:]]+dynamic[[:space:]]*=/ {
            if (!seen_dynamic) {
                seen_dynamic = 1
                print
            }
            next
        }
        { print }
        ' "${TEMP_FILE}" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "${TEMP_FILE}"
        CHANGED=true
    fi
    
    # Remove duplicate revalidate exports (keep first)
    if [ "$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+revalidate[[:space:]]*=' "${TEMP_FILE}")" -gt 1 ]; then
        echo "  Removing duplicate revalidate exports"
        awk '
        /^[[:space:]]*export[[:space:]]+const[[:space:]]+revalidate[[:space:]]*=/ {
            if (!seen_revalidate) {
                seen_revalidate = 1
                print
            }
            next
        }
        { print }
        ' "${TEMP_FILE}" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "${TEMP_FILE}"
        CHANGED=true
    fi
    
    # Remove duplicate runtime exports (keep first)
    if [ "$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+runtime[[:space:]]*=' "${TEMP_FILE}")" -gt 1 ]; then
        echo "  Removing duplicate runtime exports"
        awk '
        /^[[:space:]]*export[[:space:]]+const[[:space:]]+runtime[[:space:]]*=/ {
            if (!seen_runtime) {
                seen_runtime = 1
                print
            }
            next
        }
        { print }
        ' "${TEMP_FILE}" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "${TEMP_FILE}"
        CHANGED=true
    fi
    
    # Replace __withNoStore with __noStore if both exist
    if grep -q '__withNoStore(' "${TEMP_FILE}" && grep -q 'function __noStore(' "${TEMP_FILE}"; then
        echo "  Replacing __withNoStore with __noStore"
        sed -i 's/__withNoStore(/__noStore(/g' "${TEMP_FILE}"
        CHANGED=true
    fi
    
    # Collapse nested __noStore calls
    if grep -q '__noStore(__noStore(' "${TEMP_FILE}"; then
        echo "  Collapsing nested __noStore calls"
        sed -i 's/__noStore(__noStore(/__noStore(/g' "${TEMP_FILE}"
        CHANGED=true
    fi
    
    # Apply changes if any were made
    if [ "${CHANGED}" = true ]; then
        cp "${TEMP_FILE}" "${file}"
        FILES_CHANGED=$((FILES_CHANGED + 1))
        echo "  Modified: ${file}"
    fi
    
    # Smoke check this file
    DYNAMIC_COUNT=$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+dynamic[[:space:]]*=' "${file}" || echo 0)
    REVALIDATE_COUNT=$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+revalidate[[:space:]]*=' "${file}" || echo 0)
    RUNTIME_COUNT=$(grep -cE '^[[:space:]]*export[[:space:]]+const[[:space:]]+runtime[[:space:]]*=' "${file}" || echo 0)
    HAS_WITHNOSTORE=$(grep -q '__withNoStore(' "${file}" && echo true || echo false)
    
    if [ "${DYNAMIC_COUNT}" -le 1 ] && [ "${REVALIDATE_COUNT}" -le 1 ] && [ "${RUNTIME_COUNT}" -le 1 ] && [ "${HAS_WITHNOSTORE}" = false ]; then
        ROUTES_HARDENED=$((ROUTES_HARDENED + 1))
    else
        echo "  SMOKE CHECK FAILED for ${file}: dynamic=${DYNAMIC_COUNT} revalidate=${REVALIDATE_COUNT} runtime=${RUNTIME_COUNT} withNoStore=${HAS_WITHNOSTORE}"
        SMOKE_PASS=false
    fi
    
    rm -f "${TEMP_FILE}"
done

# Check middleware
MIDDLEWARE_API_EXCLUDED="YES"
if [ -f "src/middleware.ts" ] && grep -q 'matcher.*\/api' "src/middleware.ts"; then
    MIDDLEWARE_API_EXCLUDED="NO"
fi

# Build check
echo "Running build check..."
BUILD_STATUS="OK"
if ! pnpm -s build > /dev/null 2>&1; then
    BUILD_STATUS="FAIL"
fi

# Final smoke check
SMOKE_STATUS="PASS"
if [ "${SMOKE_PASS}" = false ]; then
    SMOKE_STATUS="FAIL"
fi

echo "Completed P4 API Policy Deduplication at $(date)"

# Print acceptance block
cat <<'EOF'
-- Acceptance --
STEP=P4_API_POLICY_DEDUPE
EOF
echo "FILES_CHANGED=${FILES_CHANGED}"
echo "ROUTES_HARDENED=${ROUTES_HARDENED}/${TOTAL_FILES}"
echo "MIDDLEWARE_API_EXCLUDED=${MIDDLEWARE_API_EXCLUDED}"
echo "BUILD=${BUILD_STATUS}"
echo "SMOKE=${SMOKE_STATUS}"
echo "NOTES=Removed duplicate exports and normalized helper function calls"
echo "-- /Acceptance --"
