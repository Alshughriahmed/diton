"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="min-h-[60vh] grid place-items-center bg-neutral-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">Error</h1>
        {error?.digest ? (
          <p className="opacity-70">Error: {error.digest}</p>
        ) : (
          <p className="opacity-70">Unexpected error occurred.</p>
        )}
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Try again
        </button>
      </div>
    </section>
  );
}
