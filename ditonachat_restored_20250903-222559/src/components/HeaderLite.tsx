"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderLite() {
  const pathname = usePathname();
  return (
    <header className="w-full px-4 py-3 flex items-center gap-3 border-b border-neutral-200">
      <Link href="/" className="font-semibold">DitonaChat</Link>
      <span className="ml-auto text-xs text-neutral-500">{pathname}</span>
    </header>
  );
}
