/**
 * HUD ميتاداتا الطرف العلوي: لا مسح على rtc:pair. مسح فقط على searching.
 * يعتمد على أحداث:
 *  - "ditona:peer-meta"  → عرض فوري
 *  - "ditona:meta:init"  → طلب إرسال ميتا الطرف الآخر
 *  - "rtc:phase"         → مسح عند searching فقط
 * يحترم pairId guard حتى لا تتسرب ميتاداتا قديمة.
 */
if (typeof window !== "undefined" && !(window as any).__peerMetaUiMounted) {
  (window as any).__peerMetaUiMounted = 1;

  const qs = (k: string) => document.querySelector(`[data-ui="${k}"]`) as HTMLElement | null;
  const $g = () => qs("peer-gender");
  const $c = () => qs("peer-country");
  const $ci = () => qs("peer-city");
  const $n = () => qs("peer-name");
  const $l = () => qs("peer-likes");
  const $v = () => qs("peer-vip");

  let curPair: string | null = null;

  const getPair = (): string | null => {
    const w: any = window as any;
    return w.__ditonaPairId || w.__pairId || null;
  };

  const clear = () => {
    $g()?.replaceChildren();
    if ($c()) $c()!.textContent = "";
    if ($ci()) $ci()!.textContent = "";
    if ($n()) $n()!.textContent = "";
    if ($l()) $l()!.textContent = "0";
    if ($v()) $v()!.classList.toggle("hidden", true);
  };

  const render = (m: any) => {
    // حارس الزوج
    const pair = getPair();
    if (curPair && pair && pair !== curPair) return;
    curPair = pair;

    const genderEl = $g();
    if (genderEl) {
      const sym = typeof m?.gender === "string" ? m.gender : "";
      genderEl.textContent = sym || "";
    }
    if ($c()) $c()!.textContent = m?.country || "";
    if ($ci()) $ci()!.textContent = m?.city || "";
    if ($n()) $n()!.textContent = m?.displayName || "";
    if ($l()) $l()!.textContent = String(typeof m?.likes === "number" ? m.likes : 0);
    if ($v()) $v()!.classList.toggle("hidden", !m?.vip);
    try { (window as any).__ditonaPeerDid = m?.did || ""; } catch {}
  };

  // m→event
  window.addEventListener("ditona:peer-meta", (ev: any) => {
    const pair = getPair();
    const pDetail = ev?.detail || {};
    const pFromEv = pDetail?.pairId || null;
    if (pair && pFromEv && pair !== pFromEv) return; // guard
    render(pDetail);
  });

  // لا مسح على rtc:pair. فقط نُحدّث pairId الحالي.
  window.addEventListener("rtc:pair", () => {
    curPair = getPair();
    // لا clear هنا.
  });

  window.addEventListener("rtc:phase", (ev: any) => {
    const ph = ev?.detail?.phase;
    if (ph === "searching" || ph === "idle" || ph === "boot") {
      curPair = null;
      clear();
    }
  });

  // عند طلب الميتا، نعيد بث "ditona:meta:init" لمزامنة الوحدات الأخرى
  window.addEventListener("ditona:meta:init", () => {
    try { window.dispatchEvent(new CustomEvent("ditona:meta:init:ack")); } catch {}
  });

  // تنظيف عند مغادرة الصفحة
  window.addEventListener("pagehide", () => { curPair = null; }, { once: true });
}
export {};
