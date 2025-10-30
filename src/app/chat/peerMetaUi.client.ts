/**
 * محدِّث DOM رشيق لبادجات ميتاداتا الطرف (B) فقط.
 * المصدر: رسائل DataChannel بموضوع meta (حدث: ditona:peer-meta) + كاش sessionStorage.
 * المتطلبات:
 * - لا نُضيف/نُزيل أصناف إخفاء. عند الانتقال لـ searching نمسح النصوص فقط.
 * - على الإقلاع نزيل مرة واحدة أصناف hidden/md:hidden/lg:hidden/opacity-0 من كل [data-ui^="peer-"].
 * - تخزين/قراءة آخر ميتا في sessionStorage["ditona:last_peer_meta"].
 * - خريطة رموز الجنس: m→♂ ، f→♀ ، c→👫 ، l→🏳️‍🌈 ، غير ذلك فارغ.
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

  // إظهار العناصر في حال كانت مخفية تكوينياً — مرة واحدة.
  const unhideAll = () => {
    document
      .querySelectorAll<HTMLElement>('[data-ui^="peer-"]')
      .forEach((el) => el.classList.remove("hidden", "md:hidden", "lg:hidden", "opacity-0"));
  };

  type Norm = "m" | "f" | "c" | "l" | "u";
  const norm = (g: unknown): Norm => {
    const s = String(g ?? "").toLowerCase().trim();
    if (s === "m" || s.startsWith("male") || s.includes("♂")) return "m";
    if (s === "f" || s.startsWith("fem") || s.includes("♀")) return "f";
    if (s === "c" || s.includes("couple") || s.includes("paar")) return "c";
    if (s === "l" || s.includes("lgbt") || s.includes("rainbow")) return "l";
    return "u";
  };
  const sym = (n: Norm) => (n === "m" ? "♂" : n === "f" ? "♀" : n === "c" ? "👫" : n === "l" ? "🏳️‍🌈" : "");

  let lastMeta: any = null;

  const clearTextsOnly = () => {
    $.name()?.replaceChildren();
    $.vip()?.replaceChildren();
    $.likes()?.replaceChildren();
    $.country()?.replaceChildren();
    $.city()?.replaceChildren();
    const g = $.gender();
    if (g) g.textContent = "";
  };

  const apply = (meta: any) => {
    if (!meta || typeof meta !== "object") return;
    unhideAll();

    // حفظ آخر ميتا للرجوع الفوري
    try {
      (window as any).__ditonaLastPeerMeta = meta;
      sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
    } catch {}

    // الاسم + VIP
    const name = $.name();
    if (name) name.textContent = String(meta.displayName || "").trim();

    const vip = $.vip();
    if (vip) vip.textContent = meta.vip ? "VIP" : "";

    // البلد + المدينة (تحترم الإخفاء إن وُجد)
    const ctry = $.country();
    if (ctry) ctry.textContent = meta.hideCountry ? "" : String(meta.country || "").trim();

    const city = $.city();
    if (city) city.textContent = meta.hideCity ? "" : String(meta.city || "").trim();

    // الجنس كرمز فقط (لا نغيّر أي فئات — اللون تحدده CSS الحالية)
    const g = $.gender();
    if (g) g.textContent = sym(norm(meta.gender));

    // اللايكات (تحترم الإخفاء)
    const likes = $.likes();
    if (likes) {
      const hidden = !!meta.hideLikes;
      likes.textContent = hidden
        ? ""
        : typeof meta.likes === "number"
        ? `♥ ${meta.likes}`
        : "";
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

  // عند طلب الميتا من الطرف الآخر نعيد حقن آخر نسخة لدينا محليًا
  window.addEventListener(
    "ditona:meta:init",
    () => {
      if (lastMeta) apply(lastMeta);
      else reapplyCached();
    },
    { passive: true } as any,
  );

  // زوج جديد → امسح ثم أعد تطبيق المعلّق عند وصوله
  window.addEventListener(
    "rtc:pair",
    () => {
      clearTextsOnly();
      setTimeout(reapplyCached, 100);
    },
    { passive: true } as any,
  );

  // عند إرفاق الغرفة تأكد من ظهور العناصر ثم إعادة ملء الكاش
  window.addEventListener(
    "lk:attached",
    () => {
      unhideAll();
      reapplyCached();
    },
    { passive: true } as any,
  );

  // استقرار HUD: في حالة البحث نمسح النصوص فقط (لا نُخفي العناصر)
  window.addEventListener(
    "rtc:phase",
    (e: any) => {
      const ph = e?.detail?.phase;
      if (ph === "searching") clearTextsOnly();
    },
    { passive: true } as any,
  );

  // مزامنة عداد الإعجابات الحي
  window.addEventListener(
    "like:sync",
    (e: any) => {
      const d = e?.detail || {};
      const likes = $.likes();
      if (likes && typeof d.count === "number") likes.textContent = `♥ ${d.count}`;
    },
    { passive: true } as any,
  );

  // إظهار أي عقد مخفية بالخطأ عند التحميل الأول + ملء الكاش فورًا
  unhideAll();
  reapplyCached();
}
export {};
