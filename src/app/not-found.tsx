import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="opacity-70">The page you requested does not exist.</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
