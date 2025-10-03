"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-white antialiased">
        <main className="min-h-screen grid place-items-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            {error?.digest ? (
              <p className="opacity-70">Error: {error.digest}</p>
            ) : null}
            <button
              onClick={() => reset()}
              className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
