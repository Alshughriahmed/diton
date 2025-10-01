"use client";
import { useEffect, useState } from "react";
import HeaderLite from "@/components/HeaderLite";
import JsonLd from "@/components/seo/JsonLd";

type Price = { id: string; unit_amount: number; currency: string; label?: string };
const eur = (n:number) => (n/100).toFixed(2);
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://www.ditonachat.com';

export default function PlansPage(){
  const [prices,setPrices]=useState<Price[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string>("");

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch("/api/stripe/prices",{cache:"no-store"});
        const j=await r.json();
        setPrices(Array.isArray(j?.prices)? j.prices : []);
      }catch(e:any){ setErr(String(e?.message||e)); }
      finally{ setLoading(false); }
    })();
  },[]);

  const buy=async(id:string)=>{
    try{
      const r=await fetch("/api/stripe/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({priceId:id})});
      const j=await r.json();
      if(j?.checkoutUrl){ window.open(j.checkoutUrl,"_blank"); }
    }catch(e){}
  };

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Plans",
        "url": `${ORIGIN}/plans`,
        "hasPart": [
          { "@type": "Offer", "name": "Daily" },
          { "@type": "Offer", "name": "Weekly" },
          { "@type": "Offer", "name": "Monthly" },
          { "@type": "Offer", "name": "Yearly" }
        ]
      }} />
      <div className="min-h-screen bg-neutral-950 text-white">
        <HeaderLite />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-bold mb-6">Choose your VIP plan</h1>
        {loading && <div className="opacity-80">Loading…</div>}
        {err && <div className="text-red-400">{err}</div>}
        <div className="grid md:grid-cols-2 gap-4">
          {prices.map(p=>(
            <div key={p.id} className="rounded-2xl border border-white/10 p-5 bg-white/5">
              <div className="text-sm opacity-80 mb-1">{p.label ?? p.id}</div>
              <div className="text-2xl font-semibold">€{eur(p.unit_amount)}</div>
              <button onClick={()=>buy(p.id)} className="mt-4 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Subscribe</button>
            </div>
          ))}
        </div>
          {!loading && prices.length===0 && (
            <div className="opacity-80">No prices found. (Fallback: 1.49 / 5.99 / 16.99 / 99.99 EUR)</div>
          )}
        </div>
      </div>
    </>
  );
}
