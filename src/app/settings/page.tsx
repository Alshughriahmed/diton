// src/app/settings/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, ChangeEvent, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useProfile } from "@/state/profile";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-neutral-900/70 rounded-2xl p-4 border border-neutral-800">
    <div className="text-white/90 font-semibold mb-3">{title}</div>
    <div className="space-y-3">{children}</div>
  </div>
);

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { profile, set, setProfile, reset } = useProfile();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const uid = useMemo(() => {
    const u = session?.user as any;
    return (u?.email || u?.id || u?.name || "").toString();
  }, [session]);

  // load server profile if logged-in, merge into local
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return;
      try {
        const r = await fetch(`/api/me/profile?uid=${encodeURIComponent(uid)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (!j || typeof j !== "object") return;
        if (cancelled) return;
        // دمج بسيط: خذ القيم الموجودة عن الخادم واحتفظ بالباقي محليًا
        setProfile({ ...profile, ...(j.profile || {}) });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function saveIfLoggedIn() {
    if (!uid) return;
    try {
      await fetch("/api/me/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ uid, profile }),
      });
    } catch {}
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      set({ avatarDataUrl: String(reader.result) });
      await saveIfLoggedIn();
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Chat settings</h1>
          {uid ? <span className="ml-auto text-xs text-emerald-400/90">Signed in</span> : null}
        </div>

        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border border-neutral-700 bg-neutral-800">
              {profile.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="avatar" src={profile.avatarDataUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-neutral-400">📷</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  value={profile.displayName}
                  onChange={(e) => set({ displayName: e.target.value.slice(0, 24) })}
                  onBlur={saveIfLoggedIn}
                  placeholder="Your display name"
                  className="flex-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                >
                  Upload
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
              </div>
              <p className="text-xs text-neutral-400">سيظهر الاسم والأفاتار للطرف الآخر عند بدء المطابقة.</p>
            </div>
          </div>
        </Section>

        <div className="h-4" />

        {/* Translation */}
        <Section title="Translation">
          <div className="flex items-center justify-between">
            <span>Translate messages automatically</span>
            <input
              type="checkbox"
              checked={profile.translation.enabled}
              onChange={async (e) => {
                set({ translation: { ...profile.translation, enabled: e.target.checked } });
                await saveIfLoggedIn();
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-300 text-sm w-28">My language</span>
            <select
              value={profile.translation.language ?? "en"}
              onChange={async (e) => {
                set({ translation: { ...profile.translation, language: e.target.value as any } });
                await saveIfLoggedIn();
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="it">Italiano</option>
              <option value="ru">Русский</option>
              <option value="tr">Türkçe</option>
              <option value="fa">فارسی</option>
            </select>
          </div>
        </Section>

        <div className="h-4" />

        {/* Hide location */}
        <Section title="Hide Your Location">
          <div className="flex items-center justify-between">
            <span>Hide Country</span>
            <input
              type="checkbox"
              onChange={async (e) => {
                set({ privacy: { ...profile.privacy, hideCountry: e.target.checked } });
                await saveIfLoggedIn();
              }}
              checked={profile.privacy.hideCountry}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Hide City</span>
            <input
              type="checkbox"
              onChange={async (e) => {
                set({ privacy: { ...profile.privacy, hideCity: e.target.checked } });
                await saveIfLoggedIn();
              }}
              checked={profile.privacy.hideCity}
            />
          </div>
          <p className="text-xs text-neutral-400">بعض عناصر الإخفاء ستكون VIP لاحقًا (قابلة للقفل).</p>
        </Section>

        <div className="h-4" />

        {/* Gender */}
        <Section title="Gender">
          <select
            value={profile.gender}
            onChange={async (e) => {
              set({ gender: e.target.value as any });
              await saveIfLoggedIn();
            }}
            className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
          >
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
            <option value="couple">زوجان</option>
            <option value="lgbt">LGBT</option>
            <option value="other">Other</option>
          </select>
        </Section>

        <div className="h-4" />

        {/* Intro message */}
        <Section title="Intro message">
          <div className="flex items-center justify-between">
            <span>Activate</span>
            <input
              type="checkbox"
              checked={profile.introEnabled}
              onChange={async (e) => {
                set({ introEnabled: e.target.checked });
                await saveIfLoggedIn();
              }}
            />
          </div>
          <textarea
            value={profile.introText}
            onChange={(e) => set({ introText: e.target.value.slice(0, 200) })}
            onBlur={saveIfLoggedIn}
            placeholder="اكتب رسالة تعريف قصيرة تُرسل آليًا عند الاتصال"
            className="w-full min-h-[90px] px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none"
          />
        </Section>

        <div className="h-4" />

        {/* Gain Followers */}
        <Section title="Gain Followers">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={profile.social?.platform ?? ""}
              onChange={async (e) => {
                set({ social: { ...profile.social, platform: e.target.value as any } });
                await saveIfLoggedIn();
              }}
              className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
            >
              <option value="">Choose platform</option>
              <option value="instagram">Instagram</option>
              <option value="snap">Snapchat</option>
              <option value="onlyfans">Onlyfans</option>
            </select>
            <input
              value={profile.social?.handle ?? ""}
              onChange={(e) => set({ social: { ...profile.social, handle: e.target.value } })}
              onBlur={saveIfLoggedIn}
              placeholder="username"
              className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
            />
          </div>
        </Section>

        <div className="h-4" />

        {/* Likes */}
        <Section title="Likes">
          <div className="flex items-center justify-between">
            <span>Show likes count</span>
            <input
              type="checkbox"
              checked={profile.likes.showCount}
              onChange={async (e) => {
                set({ likes: { showCount: e.target.checked } });
                await saveIfLoggedIn();
              }}
            />
          </div>
        </Section>

        <div className="h-4" />

        {/* VIP Badge (placeholder) */}
        <Section title="VIP Badge">
          <p className="text-sm text-neutral-300">سيتم تفعيل ميزات VIP من Stripe تلقائيًا. هذه بطاقة تمهيدية.</p>
        </Section>

        <div className="h-6" />

        <div className="flex items-center justify-between">
          <button
            onClick={() => reset()}
            className="px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
          >
            Reset
          </button>
          <button
            onClick={() => router.push("/chat")}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Back to Chat
          </button>
        </div>
      </div>
    </div>
  );
}
