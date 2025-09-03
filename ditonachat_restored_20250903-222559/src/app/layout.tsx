import AuthProvider from "@/components/providers/AuthProvider";
import * as React from 'react';
export const metadata = { title: 'DitonaChat' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
