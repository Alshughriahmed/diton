import "./globals.css";
import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "DitonaChat",
  description: "18+ random video chat with smart gender & country filters.",
};

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ditonachat.com';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "DitonaChat",
          "url": ORIGIN,
          "logo": `${ORIGIN}/icon.png`
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "url": ORIGIN,
          "name": "DitonaChat"
        }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "DitonaChat",
          "applicationCategory": "Communication",
          "operatingSystem": "Web"
        }} />
      </head>
      <body className="bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  );
}
