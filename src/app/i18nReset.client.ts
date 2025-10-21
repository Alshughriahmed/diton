"use client";

// Force English-only persisted values. If unknown → reset to safe defaults.
(function fixPersisted() {
  try {
    const clampProfile = () => {
      const raw = localStorage.getItem("ditona.profile.v1");
      if (!raw) return;
      const j = JSON.parse(raw);
      const st = j?.state ?? j;
      const g = String(st?.profile?.gender ?? "");
      const ok = ["m", "f", "c", "l", "u"].includes(g);
      if (!ok && st?.profile) st.profile.gender = "u";
      localStorage.setItem("ditona.profile.v1", JSON.stringify(j?.state ? { ...j, state: st } : st));
    };

    const clampFilters = () => {
      const raw = localStorage.getItem("ditona.filters.v1");
      if (!raw) return;
      const j = JSON.parse(raw);
      const st = j?.state ?? j;
      const g = String(st?.gender ?? "");
      const allowed = ["all", "male", "female", "couple", "lgbt"];
      if (!allowed.includes(g)) st.gender = "all";
      // countries already ISO; leave as-is
      localStorage.setItem("ditona.filters.v1", JSON.stringify(j?.state ? { ...j, state: st } : st));
    };

    clampProfile();
    clampFilters();
  } catch {}
})();
