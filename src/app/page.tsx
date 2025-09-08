// server component: exports metadata only
export const metadata = {
  title: "DitonaChat — Adult Video Chat 18+ | Random Cam Chat",
  description: "18+ random video chat with smart gender & country filters. Instant matching. Free to start. VIP unlocks Prev and pro features.",
  alternates: { canonical: "/" },
  twitter: { card: "summary_large_image", title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat." },
  openGraph: { title: "DitonaChat — Adult Video Chat 18+", description: "Fast, 18+ random cam chat.", url: "/", siteName: "DitonaChat", type: "website" },
} as const;

import HomeClient from "@/components/home/HomeClient";

export default function Page(){ 
  return <HomeClient />; 
}