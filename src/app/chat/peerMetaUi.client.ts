/**
 * محدِّث DOM لبادجات ميتاداتا الطرف (B) فقط.
 * المصدر: رسائل DataChannel بموضوع meta → حدث window: ditona:peer-meta
 * - Pair guard: تجاهل أي ميتاداتا لا تطابق pairId الحالي.
 * - لا نُضيف/نُزيل أصناف إخفاء. عند الانتقال لـ boot/idle/searching/stopped نمسح النصوص فقط.
 * - على الإقلاع نزيل مرة واحدة أصناف hidden/md:hidden/lg:hidden/opacity-0 من كل [data-ui^="peer-"].
 * - تخزين/قراءة آخر ميتا في sessionStorage["ditona:last_peer_meta"].
 * - خريطة رموز الجنس: m→♂ ، f→♀ ، c→⚤ ، l→🏳️‍🌈 ؛ والألوان: m=blue-500, f=red-500, c=red-700, l=as-is.
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
    avatar: () => qs('[data-ui="peer-avatar"]'),
  };

  const curPair = (): string | null => {
    try {
      const w: any = window as any;
      return w.__ditonaPairId || w.__pairId || null;
    } catch {
      return null;
    }
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
  const sym = (n: Norm) => (n === "m" ? "♂" : n === "f" ? "♀" : n === "c" ? "⚤" : n === "l" ? "🏳️‍🌈" : "");
  const color = (n: Norm) =>
    n === "m" ? "text-blue-500" : n === "f" ? "text-red-500" : n === "c" ? "text-red-700" : "";

  let lastMeta: any = null;

  const clearTextsOnly = () => {
    $.name()?.replaceChildren();
    $.vip()?.replaceChildren();
    $.likes()?.replaceChildren();
    $.country()?.replaceChildren();
    $.city()?.replaceChildren();
    const g = $.gender();
    if (g) {
      g.textContent = "";
      // إزالة أي لون سابق
      g.className = g.className.replace(/\btext-(?:[a-z]+(?:-\d{2,3})?\/?\d*|white\/\d+)\b/g, "");
    }
    const av = $.avatar();
    if (av) {
      (av as HTMLElement).style.backgroundImage = "";
    }
  };

  const apply = (meta: any) => {
    if (!meta || typeof meta !== "object") return;

    // Pair guard
    const pid = meta?.pairId || curPair();
    if (pid && curPair() && pid !== curPair()) return;

    unhideAll();

    // حفظ آخر ميتا للرجوع الفوري
    try {
      (window as any).__ditonaLastPeerMeta = meta;
      sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
    } catch {}

    // الصورة كـ bg-cover
    const avUrl: string = String(meta.avatarUrl || meta.avatar || "") || "";
    const av = $.avatar();
    if (av) {
      av.classList.add("bg-center", "bg-cover", "rounded-full", "ring-1", "ring-white/20");
      (av as HTMLElement).style.backgroundImage = avUrl ? `url(${avUrl})` : "";
    }

    // الاسم + VIP (رموز)
    const name = $.name();
    if (name) name.textContent = String(meta.displayName || "").trim();

    const vip = $.vip();
    if (vip) vip.textContent = typeof meta.vip === "boolean" ? (meta.vip ? "👑" : "🚫👑") : "";

    // البلد + المدينة (تحترم الإخفاء)
    const ctry = $.country();
    if (ctry) ctry.textContent = meta.hideCountry ? "" : String(meta.country || "").trim();

    const city = $.city();
    if (city) city.textContent = meta.hideCity ? "" : String(meta.city || "").trim();

    // الجنس كرمز + لون ثابت
    const g = $.gender();
    if (g) {
      const n = norm(meta.gender);
      g.textContent = sym(n);
      // نظّف أي لون سابق ثم أضف اللون الجديد (L كما هو دون لون)
      g.className = g.className.replace(/\btext-(?:[a-z]+(?:-\d{2,3})?\/?\d*|white\/\d+)\b/g, "");
      const c = color(n);
      if (c) g.classList.add(c);
      // الحجم يُحدَّد من CSS في React (PeerOverlay)؛ لا نضيف/نزيل أحجام هنا.
    }

    // اللايكات (تحترم الإخفاء)
    const likes = $.likes();
    if (likes) {
      const hidden = !!meta.hideLikes;
      likes.textContent = hidden ? "" : typeof meta.likes === "number" ? `❤️ ${meta.likes}` : "";
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

  // استقرار HUD: phases to clear (لا نخفي العناصر)
  window.addEventListener(
    "rtc:phase",
    (e: any) => {
      const ph = e?.detail?.phase;
      if (ph === "boot" || ph === "idle" || ph === "searching" || ph === "stopped") clearTextsOnly();
    },
    { passive: true } as any,
  );

  // مزامنة عداد الإعجابات الحي (مع Pair guard)
  window.addEventListener(
    "like:sync",
    (e: any) => {
      const d = e?.detail || {};
      const pid = d?.pairId || curPair();
      if (pid && curPair() && pid !== curPair()) return;
      const likes = $.likes();
      if (likes && typeof d.count === "number") likes.textContent = `❤️ ${d.count}`;
    },
    { passive: true } as any,
  );

  // إظهار أي عقد مخفية بالخطأ عند التحميل الأول + ملء الكاش فورًا
  unhideAll();
  reapplyCached();
}
export {};
