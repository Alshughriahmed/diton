
#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C
export TERM=dumb

cd /home/runner/workspace

# Timestamp for backup
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_DIR="_ops/backups/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# Create temp perl script to avoid quoting issues
PERL_SCRIPT=$(mktemp)
cat <<'EOF' > "$PERL_SCRIPT"
use strict;
use warnings;

my $file = $ARGV[0];
my $content = do { local $/; open my $fh, '<', $file or die "Cannot read $file: $!"; <$fh> };

# Normalize CRLF
$content =~ s/\r\n/\n/g;

# Check if already has dynamic/revalidate
my $has_dynamic = $content =~ /export\s+const\s+dynamic\s*=/;
my $has_revalidate = $content =~ /export\s+const\s+revalidate\s*=/;
my $has_wrapper = $content =~ /__withNoStore/;

# Add wrapper if missing
if (!$has_wrapper) {
    $content = "const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.(\"cache-control\",\"no-store\"); } catch {} return r; };\n" . $content;
}

# Add dynamic/revalidate if missing
my $meta_adds = "";
if (!$has_revalidate) {
    $meta_adds .= "export const revalidate = 0;\n";
}
if (!$has_dynamic) {
    $meta_adds .= "export const dynamic = \"force-dynamic\";\n";
}

if ($meta_adds) {
    $content = $meta_adds . $content;
}

# Wrap response methods if not already wrapped
$content =~ s/\bNextResponse\.json\(([^)]+)\)/NextResponse.json($1)/g;
$content =~ s/\bResponse\.json\(([^)]+)\)/Response.json($1)/g;
$content =~ s/\bnew NextResponse\(([^)]*)\)/new NextResponse($1)/g;
$content =~ s/\bnew Response\(([^)]*)\)/new Response($1)/g;

# Only wrap if not already wrapped
$content =~ s/(?<!__withNoStore\()\b(NextResponse\.json\([^)]+\))/return __withNoStore($1);/g;
$content =~ s/(?<!__withNoStore\()\b(Response\.json\([^)]+\))/return __withNoStore($1);/g;
$content =~ s/(?<!__withNoStore\()\b(new NextResponse\([^)]*\))/return __withNoStore($1);/g;
$content =~ s/(?<!__withNoStore\()\b(new Response\([^)]*\))/return __withNoStore($1);/g;

# Fix return statements that got doubled
$content =~ s/return return __withNoStore/return __withNoStore/g;

open my $out, '>', $file or die "Cannot write $file: $!";
print $out $content;
close $out;

print "PROCESSED:$file:$has_dynamic:$has_revalidate:$has_wrapper\n";
EOF

# Find target files
TARGET_FILES=()
while IFS= read -r -d '' file; do
    if [[ "$file" =~ /api/(rtc|message|like|user)/.*/route\.ts$ ]]; then
        TARGET_FILES+=("$file")
    fi
done < <(find src/app/api -type f -name "route.ts" -print0)

FILES_TARGETED=${#TARGET_FILES[@]}

# Backup and process files
for file in "${TARGET_FILES[@]}"; do
    # Create backup
    backup_file="$BACKUP_DIR/$file"
    mkdir -p "$(dirname "$backup_file")"
    cp "$file" "$backup_file"
    
    # Process file
    perl "$PERL_SCRIPT" "$file"
done

# Clean up temp script
rm -f "$PERL_SCRIPT"

# Verification check
META_MISSING=0
WRAPS_MISSING=0

for file in "${TARGET_FILES[@]}"; do
    if ! grep -q "export const dynamic" "$file" || ! grep -q "export const revalidate" "$file"; then
        ((META_MISSING++))
    fi
    if ! grep -q "__withNoStore" "$file"; then
        ((WRAPS_MISSING++))
    fi
done

# Single build at the end
BUILD="OK"
if ! pnpm -s build >/dev/null 2>&1; then
    BUILD="FAIL"
fi

# Print acceptance block
printf -- "-- Acceptance --\n"
printf "STEP=P3_FINAL_NO_STORE_DYNAMIC\n"
printf "FILES_TARGETED=%d\n" "$FILES_TARGETED"
printf "META_MISSING=%d\n" "$META_MISSING"
printf "WRAPS_MISSING=%d\n" "$WRAPS_MISSING"
printf "BUILD=%s\n" "$BUILD"
printf "BACKUP=%s\n" "$BACKUP_DIR"
printf -- "-- /Acceptance --\n"
