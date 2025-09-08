#!/usr/bin/env bash
set -euo pipefail
ROOT="${DITONA_ROOT:-/home/runner/workspace}"; cd "$ROOT"

ts="$(date -u +%Y%m%d-%H%M%S)"
backup="_ops/backups/home_finalize_$ts"; report="_ops/reports/home_finalize_$ts"
mkdir -p "$backup" "$report" src/components/home

PAGE="src/app/page.tsx"
HOME_CLIENT="src/components/home/HomeClient.tsx"
HEADER="src/components/HeaderLite.tsx"
GEO_API="src/app/api/geo/route.ts"
MATCH_ROUTE="src/app/api/match/next/route.ts"
CHATCLIENT="src/app/chat/ChatClient.tsx"
TERMS="src/app/terms/page.tsx"
PRIV="src/app/privacy/page.tsx"

# --- backups
for f in "$PAGE" "$HOME_CLIENT" "$HEADER" "$GEO_API" "$MATCH_ROUTE" "$CHATCLIENT" "$TERMS" "$PRIV"; do
  [ -f "$f" ] && install -D "$f" "$backup/$f"
done

# --- 1) Make server page.tsx (exports metadata) and delegate UI to HomeClient
cat > "$PAGE" <<'TSX'
// server component
export const metadata = {
  title: "DitonaChat — Adult Video Chat 18+ | Random Cam Chat",
  description: "18+ random video chat with smart gender & country filters. Instant matching. Free to start. VIP unlocks Prev and pro features.",
  alternates: { canonical: "/" },
  twitter: { card: "summary_large_image", title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat." },
  openGraph: { title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat.", url: "/", siteName: "DitonaChat", type: "website" },
} as const;

import HomeClient from "@/components/home/HomeClient";
export default function Page(){ return <HomeClient />; }
TSX

# --- 2) HomeClient.tsx (client UI) — moved from previous page.tsx version if exists, else create fresh
cat > "$HOME_CLIENT" <<'TSX'
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderLite from "@/components/HeaderLite";

type MyGender = "male" | "female" | "couple" | "lgbt";

const genderOptions: {key: MyGender; label: string; symbol: string}[] = [
  { key: "male",   label: "Male",   symbol: "♂" },
  { key: "female", label: "Female", symbol: "♀" },
  { key: "couple", label: "Couple", symbol: "⚥" },
  { key: "lgbt",   label: "LGBT",   symbol: "🏳️‍🌈 ⚧" },
];

function classesFor(g: MyGender){
  switch(g){
    case "male":   return { text:"text-blue-600",  border:"border-blue-600",  rainbow:false };
    case "female": return { text:"text-red-600",   border:"border-red-600",   rainbow:false };
    case "couple": return { text:"text-red-400",   border:"border-red-400",   rainbow:false };
    case "lgbt":   return { text:"",               border:"border-purple-600", rainbow:true };
  }
}
const rainbowText = "bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent";

export default function HomeClient(){
  const router = useRouter();
  const [gender, setGender] = useState<MyGender | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [geo, setGeo] = useState<any>(null);

  useEffect(() => {
    let timedOut = false;
    const done = (data:any) => { try { localStorage.setItem("ditona_geo", JSON.stringify(data)); } catch{} setGeo(data); };
    try{
      const w:any = window;
      if (w?.navigator?.geolocation){
        const t = setTimeout(()=>{ timedOut = true; }, 3000);
        w.navigator.geolocation.getCurrentPosition(
          (pos:any) => { if (!timedOut){ clearTimeout(t); done({ lat: pos.coords.latitude, lon: pos.coords.longitude, src: "geolocation" }); } },
          () => {},
          { enableHighAccuracy:false, maximumAge: 60_000, timeout: 2500 }
        );
      }
    }catch{}
    fetch("/api/geo").then(r=>r.json()).then((d)=>{ if(!geo) done(d); }).catch(()=>{});
  }, []);

  const canStart = useMemo(()=> Boolean(gender) && ageOk, [gender, ageOk]);

  async function onStart(){
    if(!canStart) return;
    try{
      try { localStorage.setItem("ditona_myGender", String(gender)); } catch {}
      if (geo) { try { localStorage.setItem("ditona_geo_hint", JSON.stringify(geo)); } catch {} }
      await fetch("/api/age/allow", { method: "POST" }).catch(()=>{});
    } finally {
      router.push("/chat");
    }
  }

  return (
    <div className="relative min-h-screen text-white">
      {/* background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[url('/hero.webp.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black/60" />
      </div>

      <HeaderLite />

      <main className="mx-auto max-w-4xl px-4 pt-28 pb-12">
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
            Welcome to Ditona Video Chat 🤗
          </span>
        </h1>
        <p className="mt-4 text-lg text-gray-300">🔥 Unleash Your Wild Side 🫦</p>

        <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl max-w-lg">
          <label className="block text-sm text-gray-300 mb-2">Select your gender</label>
          <div className="grid grid-cols-2 gap-3">
            {genderOptions.map(opt => {
              const cls = classesFor(opt.key);
              const active = gender===opt.key ? "ring-2 ring-white" : "";
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={()=>setGender(opt.key)}
                  className={`px-3 py-3 rounded-lg border bg-black/40 hover:bg-black/30 transition-colors ${active} ${cls.border}`}
                  aria-label={opt.label}
                >
                  {opt.key !== "lgbt" ? (
                    <span className={`flex items-center gap-2 ${cls.text}`}>
                      <span className="text-2xl leading-none">{opt.symbol}</span>
                      <span className="text-base font-semibold">{opt.label}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-2xl leading-none">🏳️‍🌈</span>
                      <span className={`text-2xl leading-none ${rainbowText}`}>⚧</span>
                      <span className={`text-base font-semibold ${rainbowText}`}>LGBT</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input id="ageok" type="checkbox" className="h-4 w-4" checked={ageOk} onChange={(e)=>setAgeOk(e.target.checked)} />
            <label htmlFor="ageok" className="text-sm text-gray-200">I confirm I am 18+</label>
          </div>

          <button
            onClick={onStart}
            disabled={!canStart}
            className="mt-6 w-full py-3 rounded-xl text-white text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-fuchsia-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            Start Video Chat
          </button>

          <div className="mt-4 text-center text-sm text-gray-300 space-x-4">
            <a href="/terms" className="hover:text-white">Terms of Use</a>
            <a href="/privacy" className="hover:text-white">Privacy Policy</a>
          </div>
          <div className="mt-2 text-center text-xs text-gray-400 space-x-3">
            <a href="mailto:info@ditonachat.com" className="hover:text-gray-200">info@ditonachat.com</a>
            <a href="mailto:user@ditonachat.com" className="hover:text-gray-200">user@ditonachat.com</a>
            <a href="mailto:suggestions@ditonachat.com" className="hover:text-gray-200">suggestions@ditonachat.com</a>
          </div>
        </div>
      </main>
    </div>
  );
}
TSX

# --- 3) Ensure header exists (idempotent)
if [ ! -f "$HEADER" ]; then
cat > "$HEADER" <<'TSX'
"use client";
import Link from "next/link";
export default function HeaderLite(){
  return (
    <header className="w-full fixed top-0 left-0 z-40">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-white text-xl font-bold hover:text-gray-300 transition-colors">
          <span className="mr-1">💫💥</span>DitonaChat
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-white bg-red-600 px-2 py-0.5 rounded text-sm font-semibold select-none">18+</span>
          <Link href="/api/auth/signin" className="text-gray-200 hover:text-white text-sm">Login</Link>
          <Link href="/api/auth/signin" className="bg-white/10 text-white text-sm px-3 py-1.5 rounded hover:bg-white/20 transition-colors">Sign in</Link>
        </div>
      </div>
    </header>
  );
}
TSX
fi

# --- 4) Append headers in ChatClient->doMatch fetch (client) (idempotent)
if [ -f "$CHATCLIENT" ] && grep -RInq 'fetch\(["'\'']/api/match/next' "$CHATCLIENT"; then
  if ! grep -RInq "x-ditona-my-gender" "$CHATCLIENT"; then
    # add headers object with locals from localStorage inside the same fetch call
    awk '
      BEGIN{added=0}
      /fetch\([\"\x27]\/api\/match\/next/ && added==0 {
        print "      const __mg = (typeof window!==\"undefined\" && window.localStorage) ? window.localStorage.getItem(\"ditona_myGender\") : null;";
        print "      const __geo = (typeof window!==\"undefined\" && window.localStorage) ? (window.localStorage.getItem(\"ditona_geo\") || window.localStorage.getItem(\"ditona_geo_hint\")) : null;";
        sub(/\)\s*$/, ", { headers: { \"x-ditona-my-gender\": (__mg||\"\"), \"x-ditona-geo\": (__geo||\"\") } })");
        added=1;
      }
      { print }
    ' "$CHATCLIENT" > "$CHATCLIENT.tmp" && mv "$CHATCLIENT.tmp" "$CHATCLIENT"
  fi
fi

# --- 5) Read headers in /api/match/next (no behavior change)
if [ -f "$MATCH_ROUTE" ] && ! grep -RInq "x-ditona-my-gender" "$MATCH_ROUTE"; then
  # inject safe header read near top of the GET handler
  awk '
    BEGIN{inserted=0}
    /export async function GET\(req: Request/ && inserted==0 {
      print;
      print "  // Optional client hints for matching (gender/location)";
      print "  try {";
      print "    const h = new Headers(req.headers);";
      print "    const _myGender = h.get(\"x-ditona-my-gender\");";
      print "    const _geo = h.get(\"x-ditona-geo\");";
      print "    void(_myGender); void(_geo);";
      print "  } catch {}";
      inserted=1; next
    }
    { print }
  ' "$MATCH_ROUTE" > "$MATCH_ROUTE.tmp" && mv "$MATCH_ROUTE.tmp" "$MATCH_ROUTE"
fi

# --- 6) Legal pages (basic content if empty or missing)
if [ ! -s "$TERMS" ]; then
  mkdir -p "$(dirname "$TERMS")"
  cat > "$TERMS" <<'TSX'
export const metadata = { title: "Terms of Use — DitonaChat", description: "Basic terms for using DitonaChat." };
export default function Terms(){
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Terms of Use</h1>
      <p>By accessing or using DitonaChat, you agree to these Terms. You must be 18+ to use this service.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Acceptable Use</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>No illegal content or behavior.</li>
        <li>No harassment, hate speech, or exploitation.</li>
        <li>Respect privacy. Do not share others’ personal data without consent.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Accounts & Subscriptions</h2>
      <p>Some features require an account or paid plan. Billing is handled by our payment processor. Refunds are evaluated case-by-case.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Disclaimer</h2>
      <p>Service is provided “as-is” without warranties. We may suspend or terminate access for policy violations.</p>
      <p className="mt-8">For questions: <a className="underline" href="mailto:info@ditonachat.com">info@ditonachat.com</a></p>
    </main>
  );
}
TSX
fi

if [ ! -s "$PRIV" ]; then
  mkdir -p "$(dirname "$PRIV")"
  cat > "$PRIV" <<'TSX'
export const metadata = { title: "Privacy Policy — DitonaChat", description: "How DitonaChat handles your data." };
export default function Privacy(){
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p>We process minimal personal data necessary to operate the service. You must be 18+.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Data We Process</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Technical logs (IP, device, timestamps) for security and abuse prevention.</li>
        <li>Account data if you sign in (email or OAuth profile).</li>
        <li>Payment metadata if you subscribe (handled by a third-party processor).</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Geo & Matching</h2>
      <p>Approximate location may be inferred from headers or your consent via the browser to improve matching. You can deny location permissions.</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Retention & Rights</h2>
      <p>Data is retained only as long as necessary. Contact us to request deletion or access.</p>
      <p className="mt-8">Questions: <a className="underline" href="mailto:privacy@ditonachat.com">privacy@ditonachat.com</a></p>
    </main>
  );
}
TSX
fi

# --- 7) Acceptance checks
PAGE_IS_SERVER=$([ -f "$PAGE" ] && ! grep -q '"use client"' "$PAGE" && echo 1 || echo 0)
CLIENT_IS_CLIENT=$([ -f "$HOME_CLIENT" ] && grep -q '"use client"' "$HOME_CLIENT" && echo 1 || echo 0)
PAGE_HAS_META=$([ -f "$PAGE" ] && grep -q 'export const metadata' "$PAGE" && echo 1 || echo 0)
CHAT_SENDS_HEADERS=$([ -f "$CHATCLIENT" ] && grep -q 'x-ditona-my-gender' "$CHATCLIENT" && echo 1 || echo 0)
API_READS_HEADERS=$([ -f "$MATCH_ROUTE" ] && grep -q 'x-ditona-my-gender' "$MATCH_ROUTE" && echo 1 || echo 0)
TERMS_OK=$([ -s "$TERMS" ] && echo 1 || echo 0)
PRIV_OK=$([ -s "$PRIV" ] && echo 1 || echo 0)

BRANCH_BASE="$(git rev-parse --abbrev-ref HEAD || echo main)"
BRANCH_NEW="fix/home-finalize-$ts"
CHANGED=0
if ! git diff --quiet; then
  git checkout -b "$BRANCH_NEW"
  git add -A
  git commit -m "fix(home): server metadata + client UI; send gender/geo headers to match; basic terms/privacy"
  CHANGED=1
fi

echo "-- Acceptance --"
echo "PAGE_IS_SERVER=$PAGE_IS_SERVER"
echo "PAGE_HAS_METADATA=$PAGE_HAS_META"
echo "CLIENT_IS_CLIENT=$CLIENT_IS_CLIENT"
echo "CHAT_SENDS_HEADERS=$CHAT_SENDS_HEADERS"
echo "API_READS_HEADERS=$API_READS_HEADERS"
echo "TERMS_OK=$TERMS_OK"
echo "PRIV_OK=$PRIV_OK"
echo "BRANCH_BASE=$BRANCH_BASE"
echo "BRANCH_NEW=$BRANCH_NEW"
echo "CHANGED=$CHANGED"
echo "BACKUP_DIR=$backup"
echo "REPORT_DIR=$report"
