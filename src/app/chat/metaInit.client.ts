// src/app/chat/metaInit.client.ts
/**
 * يلتقط الموقع الجغرافي مرة واحدة ويخزّنه في localStorage: "ditona_geo".
 * أولاً نحاول Geolocation API، وإن رُفض نستخدم /api/regions (IP geo).
 */

if (typeof window !== "undefined" && !(window as any).__ditonaMetaInitReady) {
  (window as any).__ditonaMetaInitReady = true;

  const save = (g: any) => {
    try {
      const payload = {
        countryCode: g.countryCode || g.cc || g.code || g.alpha2 || "",
        country: g.country || g.countryName || g.name || "",
        city: g.city || g.locality || g.town || "",
        ts: Date.now(),
      };
      localStorage.setItem("ditona_geo", JSON.stringify(payload));
      (window as any).__ditonaGeo = payload;
    } catch {}
  };

  const need = () => {
    try {
      const raw = localStorage.getItem("ditona_geo");
      if (!raw) return true;
      const j = JSON.parse(raw);
      // حدّث كل 24 ساعة
      return !j?.ts || Date.now() - Number(j.ts) > 24 * 60 * 60 * 1000;
    } catch { return true; }
  };

  const viaIP = async () => {
    try {
      const r = await fetch("/api/regions", { credentials: "include", cache: "no-store" });
      if (r.ok) save(await r.json());
    } catch {}
  };

  const viaGeo = () =>
    new Promise<void>((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          // لدينا إحداثيات فقط، نكتفي بحفظ المدينة من IP fallback لاحقًا
          () => resolve(), // لا نستخدم الإحداثيات هنا لتفادي خدمات عكسية
          () => resolve(),
          { maximumAge: 600000, timeout: 3000, enableHighAccuracy: false }
        );
      } catch { resolve(); }
    });

  (async () => {
    if (!need()) return;
    await viaGeo(); // يطلب الإذن إن لزم
    await viaIP();  // المصدر الموثوق للبلد/المدينة
  })();
}

export {};
