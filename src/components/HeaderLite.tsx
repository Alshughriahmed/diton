"use client";

import Link from 'next/link';
import { useSession } from "next-auth/react";

export default function HeaderLite() {
 const { data: session } = useSession();
  return (
    <header className="bg-gray-900 text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          DitonaChat
        </Link>
        <nav className="flex gap-4">
          <Link href="/chat" className="hover:text-blue-400 transition-colors">
            Start Chat
          </Link>
          <Link href="/plans" className="hover:text-blue-400 transition-colors">
            VIP Plans
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-red-500 font-semibold text-sm">18+</span>
            {session?.user ? (
              <>
                <span className="text-sm text-neutral-300">{session.user.email ?? "Account"}</span>
                <a href="/api/auth/signout" className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm">Sign out</a>
              </>
            ) : (
              <a href="/api/auth/signin" className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm">Sign in</a>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
