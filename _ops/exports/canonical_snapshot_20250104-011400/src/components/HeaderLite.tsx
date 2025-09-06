"use client";

import Link from 'next/link';

export default function HeaderLite() {
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
          <Link href="/api/auth/signin" className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
