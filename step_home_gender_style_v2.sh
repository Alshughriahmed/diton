#!/usr/bin/env bash
set -euo pipefail

ROOT="${DITONA_ROOT:-/home/runner/workspace}"
cd "$ROOT"

ts="$(date -u +%Y%m%d-%H%M%S)"
backup="_ops/backups/home_gender_${ts}"
report="_ops/reports/home_gender_${ts}"
mkdir -p "$backup" "$report"

HOME="src/app/page.tsx"
HEADER="src/components/HeaderLite.tsx"
GEO_API="src/app/api/geo/route.ts"
install -D "$HOME" "$backup/page.tsx.orig" 2>/dev/null || true

cat > "$HOME" <<'EOF_TSX'
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

export const metadata = {
  title: "DitonaChat — Adult Video Chat 18+ | Random Cam Chat",
  description: "18+ random video chat with smart gender & country filters. Instant matching. Free to start. VIP unlocks Prev and pro features.",
  alternates: { canonical: "/" },
  twitter: { card: "summary_large_image", title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat." },
  openGraph: { title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat.", url: "/", siteName: "DitonaChat", type: "website" },
} as const;

export default function HomePage(){
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
EOF_TSX

# تأكيد وجود الهيدر وAPI
mkdir -p src/components src/app/api/geo
[ -f "$HEADER" ] || cat > "$HEADER" <<'EOF_H'
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
EOF_H

[ -f "$GEO_API" ] || cat > "$GEO_API" <<'EOF_G'
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const h = new Headers((req as any).headers);
  const data = {
    country: h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || null,
    city:    h.get("x-vercel-ip-city")    || null,
    region:  h.get("x-vercel-ip-region")  || null,
    lat:     h.get("x-vercel-ip-latitude")|| null,
    lon:     h.get("x-vercel-ip-longitude")|| null,
    ip:      h.get("x-forwarded-for")     || h.get("x-real-ip") || null,
    src: "headers"
  };
  return NextResponse.json(data, { status: 200 });
}
EOF_G

# تحقّق وقبول
grep -q '♂' "$HOME" && HAS_MALE=1 || HAS_MALE=0
grep -q '♀' "$HOME" && HAS_FEMALE=1 || HAS_FEMALE=0
grep -q '⚥' "$HOME" && HAS_COUPLE=1 || HAS_COUPLE=0
grep -q 'LGBT' "$HOME" && HAS_LGBT=1 || HAS_LGBT=0
grep -q 'bg-gradient-to-r.*to-purple-600' "$HOME" && HAS_RAINBOW=1 || HAS_RAINBOW=0
grep -q "bg-\[url('/hero.webp.webp')\]" "$HOME" && HAS_BG=1 || HAS_BG=0

BRANCH_BASE="$(git rev-parse --abbrev-ref HEAD || echo main)"
BRANCH_NEW="feat/home-gender-style-${ts}"
CHANGED=0
if ! git diff --quiet; then
  git checkout -b "$BRANCH_NEW"
  git add -A
  git commit -m "ui(home): standardized gender icons/colors and larger symbols; keep geo + 18+ gate"
  CHANGED=1
fi

echo "-- Acceptance --"
echo "HAS_MALE=$HAS_MALE"
echo "HAS_FEMALE=$HAS_FEMALE"
echo "HAS_COUPLE=$HAS_COUPLE"
echo "HAS_LGBT=$HAS_LGBT"
echo "HAS_RAINBOW=$HAS_RAINBOW"
echo "HAS_BG=$HAS_BG"
echo "BRANCH_BASE=$BRANCH_BASE"
echo "BRANCH_NEW=$BRANCH_NEW"
echo "CHANGED=$CHANGED"
echo "BACKUP_DIR=$backup"
echo "REPORT_DIR=$report"
