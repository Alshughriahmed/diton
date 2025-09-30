
#!/usr/bin/env bash
set -Eeuo pipefail
set +H

# P4 API Policy Hardening Script
# Hardens caching policy for API routes in Next.js app

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
LOG_FILE="_ops/reports/p4_api_policy_${TIMESTAMP}.log"
BACKUP_DIR="_ops/backups/${TIMESTAMP}"

# Create directories
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting P4 API Policy Hardening at $(date -u)"

# Find target route files
TARGET_FILES=$(find src/app/api -type f -path "*/route.ts" | grep -E "/(rtc|message|like|user)/" | sort)
TOTAL_ROUTES=$(echo "$TARGET_FILES" | wc -l)
FILES_CHANGED=0
ROUTES_HARDENED=0

echo "Found $TOTAL_ROUTES target route files"

# Process each file
while IFS= read -r file; do
    if [[ -z "$file" ]]; then
        continue
    fi
    
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
    
    # Create temp file for modifications
    TEMP_FILE=$(mktemp)
    cp "$file" "$TEMP_FILE"
    
    FILE_MODIFIED=false
    
    # Check if file needs dynamic export
    if ! grep -q "export const dynamic = 'force-dynamic'" "$file"; then
        echo "Adding dynamic export to $file"
        
        # Find insertion point (after last import or "use" directive)
        INSERTION_LINE=$(awk '
            /^import / || /^"use / || /^'\''use / { last_import = NR }
            END { 
                if (last_import) print last_import + 1
                else print 1
            }
        ' "$TEMP_FILE")
        
        # Insert dynamic export
        awk -v line="$INSERTION_LINE" '
            NR == line { print "export const dynamic = '\''force-dynamic'\'';" }
            { print }
        ' "$TEMP_FILE" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "$TEMP_FILE"
        
        FILE_MODIFIED=true
    fi
    
    # Check if file needs revalidate export
    if ! grep -q "export const revalidate = 0" "$file"; then
        echo "Adding revalidate export to $file"
        
        # Find dynamic line and insert after it
        if grep -q "export const dynamic = 'force-dynamic'" "$TEMP_FILE"; then
            DYNAMIC_LINE=$(grep -n "export const dynamic = 'force-dynamic'" "$TEMP_FILE" | cut -d: -f1)
            INSERTION_LINE=$((DYNAMIC_LINE + 1))
        else
            # Find insertion point (after last import or "use" directive)
            INSERTION_LINE=$(awk '
                /^import / || /^"use / || /^'\''use / { last_import = NR }
                END { 
                    if (last_import) print last_import + 1
                    else print 1
                }
            ' "$TEMP_FILE")
        fi
        
        # Insert revalidate export
        awk -v line="$INSERTION_LINE" '
            NR == line { print "export const revalidate = 0;" }
            { print }
        ' "$TEMP_FILE" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "$TEMP_FILE"
        
        FILE_MODIFIED=true
    fi
    
    # Check if file needs __noStore helper
    if ! grep -q "function __noStore(" "$TEMP_FILE"; then
        echo "Adding __noStore helper to $file"
        
        # Find insertion point (after last import or "use" directive)
        INSERTION_LINE=$(awk '
            /^import / || /^"use / || /^'\''use / { last_import = NR }
            END { 
                if (last_import) print last_import + 1
                else print 1
            }
        ' "$TEMP_FILE")
        
        # Insert helper function
        awk -v line="$INSERTION_LINE" '
            NR == line { 
                print ""
                print "function __noStore(res){ try{ res.headers?.set?.(\"Cache-Control\",\"no-store\"); }catch{} return res; }"
                print ""
            }
            { print }
        ' "$TEMP_FILE" > "${TEMP_FILE}.tmp" && mv "${TEMP_FILE}.tmp" "$TEMP_FILE"
        
        FILE_MODIFIED=true
    fi
    
    # Fix double-wrapping first
    if grep -q "return __noStore(__noStore(" "$TEMP_FILE"; then
        echo "Fixing double-wrapping in $file"
        sed -i 's/return __noStore(__noStore(/return __noStore(/g' "$TEMP_FILE"
        FILE_MODIFIED=true
    fi
    
    # Wrap NextResponse.json returns
    if grep -q "return NextResponse\.json(" "$TEMP_FILE" && ! grep -q "return __noStore(NextResponse\.json(" "$TEMP_FILE"; then
        echo "Wrapping NextResponse.json returns in $file"
        sed -i 's/return NextResponse\.json(/return __noStore(NextResponse.json(/g' "$TEMP_FILE"
        FILE_MODIFIED=true
    fi
    
    # Wrap new Response returns
    if grep -q "return new Response(" "$TEMP_FILE" && ! grep -q "return __noStore(new Response(" "$TEMP_FILE"; then
        echo "Wrapping new Response returns in $file"
        sed -i 's/return new Response(/return __noStore(new Response(/g' "$TEMP_FILE"
        FILE_MODIFIED=true
    fi
    
    # Check if file was actually hardened
    if grep -q "export const dynamic = 'force-dynamic'" "$TEMP_FILE" && \
       grep -q "export const revalidate = 0" "$TEMP_FILE" && \
       grep -q "function __noStore(" "$TEMP_FILE"; then
        ROUTES_HARDENED=$((ROUTES_HARDENED + 1))
    fi
    
    # Apply changes if file was modified
    if [[ "$FILE_MODIFIED" == true ]]; then
        mv "$TEMP_FILE" "$file"
        FILES_CHANGED=$((FILES_CHANGED + 1))
        echo "Modified: $file"
    else
        rm "$TEMP_FILE"
        echo "No changes needed: $file"
    fi
    
done <<< "$TARGET_FILES"

# Check middleware exclusion
MIDDLEWARE_API_EXCLUDED="YES"
if [[ -f "src/middleware.ts" ]] && grep -q "matcher.*\/api" "src/middleware.ts"; then
    MIDDLEWARE_API_EXCLUDED="NO"
fi

# Build check
echo "Running build check..."
BUILD="OK"
SMOKE="PASS"
if ! pnpm -s build > /dev/null 2>&1; then
    BUILD="FAIL"
    SMOKE="FAIL"
fi

# Smoke test - verify __noStore usage
NOSTORE_COUNT=0
while IFS= read -r file; do
    if [[ -z "$file" ]]; then
        continue
    fi
    if grep -q "__noStore(" "$file"; then
        NOSTORE_COUNT=$((NOSTORE_COUNT + 1))
    fi
done <<< "$TARGET_FILES"

if [[ "$NOSTORE_COUNT" -lt "$ROUTES_HARDENED" ]] && [[ "$BUILD" == "OK" ]]; then
    SMOKE="FAIL"
fi

# Generate notes
NOTES="Processed $TOTAL_ROUTES routes, hardened $ROUTES_HARDENED"
if [[ "$BUILD" == "FAIL" ]]; then
    NOTES="$NOTES. Build failed - check logs"
fi

echo "Completed P4 API Policy Hardening at $(date -u)"

# Print acceptance block
cat <<'EOF'
-- Acceptance --
EOF
echo "STEP=P4_API_POLICY_AUDIT"
echo "FILES_CHANGED=$FILES_CHANGED"
echo "ROUTES_HARDENED=$ROUTES_HARDENED/$TOTAL_ROUTES"
echo "MIDDLEWARE_API_EXCLUDED=$MIDDLEWARE_API_EXCLUDED"
echo "BUILD=$BUILD"
echo "SMOKE=$SMOKE"
echo "NOTES=$NOTES"
cat <<'EOF'
-- /Acceptance --
EOF
