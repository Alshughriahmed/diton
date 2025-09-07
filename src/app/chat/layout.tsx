import type { Metadata } from "next";
import { pageMetadata, seoConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageMetadata.chat.title,
  description: pageMetadata.chat.description,
  openGraph: {
    title: pageMetadata.chat.title,
    description: pageMetadata.chat.description,
    siteName: seoConfig.siteName,
    url: `${seoConfig.baseUrl}/chat`,
    type: 'website'
  },
  alternates: {
    canonical: `${seoConfig.baseUrl}/chat`
  }
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
