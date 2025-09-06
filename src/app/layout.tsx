import "./globals.css";
import type { Metadata } from "next";
import CookieBanner from "@/components/common/CookieBanner";

export const metadata: Metadata = {
  title: "DitonaChat",
  description: "18+ random video chat with smart gender & country filters.",
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
