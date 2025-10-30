/**
 * محدِّث DOM رشيق لبادجات ميتاداتا الطرف.
 * يعالج: ditona:peer-meta, ditona:meta:init, rtc:pair, lk:attached, like:sync, rtc:phase
 * لا يستخدم أي كلاس إخفاء، ويضمن إظهار العناصر على كل المقاسات.
 */
if (typeof window !== "undefined" && !(window as any).__peerMetaUiMounted) {
  (window as any).__peerMetaUiMounted = 1;

  // ---- أدوات ----
  const qs = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  const $ = {
    name: () => qs('[data-ui="peer-name"]'),
    vip: () => qs('[data-ui="peer-vip"]'),
    likes: () => qs('[data-ui="peer-likes"]'),
    country: () => qs('[data-ui="peer-country"]'),
    city: () => qs('[data-ui="peer-city"]'),
    gender: () => qs('[data-ui="peer-gender"]'),
  };

  const unhideAll = () => {
    document
      .querySelectorAll<HTMLElement>('[data-ui^="peer-"]')
      .forEach((el) => el.classList.remove("hidden", "md:hidden", "lg:hidden", "opacity-0"));
  };

  type Norm = "m" | "f" | "c" | "l" | "u";
  const norm = (g: unknown): Norm => {
    const s = String(g ?? "").toLowerCase();
    if (s === "m" || s.startsWith("male") || s.includes("♂")) return "m";
    if (s === "f" || s.startsWith("fem") || s.includes("♀")) return "f";
    if (s === "c" || s.includes("couple") || s.includes("paar")) return "c";
    if (s === "l" || s.includes("lgbt") || s.includes("rainbow")) return "l";
    return "u";
  };
  const sym = (n: Norm) => (n === "m" ? "♂" : n === "f" ? "♀" : n === "c" ? "👫" : n === "l" ? "🏳️‍🌈" : "？");
  const cls = (n: Norm) =>
    n === "m"
      ? "text-blue-500"
      : n === "f"
      ? "text-rose-500"
      : n === "c"
      ? "text-red-500"
      : n === "l"
      ? "text-emerald-400"
      : "text-white/70";

  let lastMeta: any = null;

  const clear = () => {
    $.name()?.replaceChildren();
    $.vip()?.replaceChildren();
    $.likes()?.replaceChildren();
    $.country()?.replaceChildren();
    $.city()?.replaceChildren();
    const g = $.gender();
    if (g) {
      g.textContent = "";
      g.className = g.className.replace(/\btext-[\w/-]+\b/g, "");
    }
  };

  const apply = (meta: any) => {
    if (!meta || typeof meta !== "object") return;
    unhideAll();

    try {
      // حفظ آخر ميتا للرجوع
      (window as any).__ditonaLastPeerMeta = meta;
      sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
    } catch {}

    // الاسم + VIP
    const name = $.name();
    if (name) name.textContent = String(meta.displayName || "").trim();

    const vip = $.vip();
    if (vip) vip.textContent = meta.vip ? "VIP" : "";

    // البلد + المدينة
    const ctry = $.country();
    if (ctry) ctry.textContent = meta.hideCountry ? "" : String(meta.country || "").trim();

    const city = $.city();
    if (city) city.textContent = meta.hideCity ? "" : String(meta.city || "").trim();

    // الجنس كرمز فقط
    const g = $.gender();
    if (g) {
      const n = norm(meta.gender);
      g.textContent = sym(n);
      // نظّف أي لون قديم ثم أضف اللون الجديد
      g.className = g.className.replace(/\btext-[\w/-]+\b/g, "");
      g.classList.add(cls(n));
    }

    // اللايكات
    const likes = $.likes();
    if (likes) {
      const hidden = !!meta.hideLikes;
      likes.textContent = hidden ? "" : (typeof meta.likes === "number" ? `♥ ${meta.likes}` : "");
    }

    lastMeta = meta;
  };

  const reapplyCached = () => {
    try {
      const w: any = window as any;
      if (w.__ditonaLastPeerMeta) return apply(w.__ditonaLastPeerMeta);
      const raw = sessionStorage.getItem("ditona:last_peer_meta");
      if (raw) return apply(JSON.parse(raw));
    } catch {}
  };

  // ---- أحداث ----
  window.addEventListener(
    "ditona:peer-meta",
    (e: any) => {
      apply(e?.detail || {});
      // إعادة تطبيق مؤجلة لسباقات التركيب
      setTimeout(() => apply(e?.detail || {}), 50);
    },
    { passive: true } as any,
  );

  window.addEventListener(
    "ditona:meta:init",
    () => {
      // عند طلب الميتا من الطرف الآخر نعيد حقن آخر نسخة لدينا محليًا
      if (lastMeta) apply(lastMeta);
      else reapplyCached();
    },
    { passive: true } as any,
  );

  window.addEventListener(
    "rtc:pair",
    () => {
      // زوج جديد → امسح ثم أعد تطبيق المعلق عند وصوله
      clear();
      setTimeout(reapplyCached, 100);
    },
    { passive: true } as any,
  );

  window.addEventListener(
    "lk:attached",
    () => {
      // عند إرفاق الغرفة تأكد من ظهور العناصر
      unhideAll();
      reapplyCached();
    },
    { passive: true } as any,
  );

  window.addEventListener(
    "rtc:phase",
    (e: any) => {
      const ph = e?.detail?.phase;
      if (ph === "searching" || ph === "idle" || ph === "boot") clear();
    },
    { passive: true } as any,
  );

  window.addEventListener(
    "like:sync",
    (e: any) => {
      const d = e?.detail || {};
      const likes = $.likes();
      if (likes && typeof d.count === "number") likes.textContent = `♥ ${d.count}`;
    },
    { passive: true } as any,
  );

  // إظهار أي عقد مخفية بالخطأ عند التحميل الأول
  unhideAll();
  reapplyCached();
}
export {};
