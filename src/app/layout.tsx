import "./globals.css";
import type { Metadata } from "next";
import CookieBanner from "@/components/common/CookieBanner";
import { seoConfig, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageMetadata.home.title,
  description: pageMetadata.home.description,
  keywords: seoConfig.keywords,
  applicationName: seoConfig.siteName,
  metadataBase: new URL(seoConfig.baseUrl),
  openGraph: {
    title: pageMetadata.home.title,
    description: pageMetadata.home.description,
    siteName: seoConfig.siteName,
    url: seoConfig.baseUrl,
    type: 'website',
    images: [
      {
        url: '/og/og-home.png',
        width: 1200,
        height: 630,
        alt: 'DitonaChat - Adult Video Chat 18+'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: pageMetadata.home.title,
    description: pageMetadata.home.description,
    images: ['/og/og-home.png']
  },
  alternates: {
    canonical: seoConfig.baseUrl
  }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="bg-gray-950 text-white antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
