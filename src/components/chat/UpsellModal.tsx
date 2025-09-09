import React, { useEffect, useState } from "react";

interface UpsellModalProps {
  open?: boolean;
  onClose?: () => void;
}

export default function UpsellModal({ open = false, onClose }: UpsellModalProps) {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stripe/prices", { cache: "no-store" });
        const json = await res.json();
        setPlans(Array.isArray(json?.plans) ? json.plans : []);
      } catch {}
    })();
  }, []);

  const subscribe = async (planId: string) => {
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.url) location.href = json.url as string;
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[101] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white text-black rounded-lg w-full max-w-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold flex justify-between items-center">
          <span>ترقية إلى VIP</span>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          )}
        </div>
        <div className="p-3 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((p: any) => (
              <div key={p.id} className="rounded border p-3 flex flex-col gap-2">
                <div className="text-sm opacity-70">{p.nickname || p.id}</div>
                <div className="text-2xl font-bold">
                  €{(p.amount / 100).toFixed(2)}{" "}
                  <span className="text-sm opacity-60">/{p.interval}</span>
                </div>
                <button
                  onClick={() => subscribe(p.id)}
                  className="mt-auto rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2"
                >
                  اشترك الآن
                </button>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="text-center text-sm opacity-70 p-6">
                لا تتوفر الخطط الآن. حاول لاحقًا.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}