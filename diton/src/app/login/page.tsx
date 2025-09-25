"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-sm w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 text-white">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <button
          onClick={() => signIn("google", { callbackUrl: "/chat" })}
          className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}