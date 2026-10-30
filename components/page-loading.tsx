// Shown while a signed-in page loads: the shape of a brief, quietly pulsing, so the
// layout doesn't jump when the real one arrives.
export function PageLoading({ label }: { label: string }) {
  return (
    <main className="horizon flex-1" aria-busy="true">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="sr-only">{label}</p>
        <div className="h-10 w-72 max-w-full animate-pulse rounded-full bg-night-2" />
        <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded-full bg-night-2" />
        <div className="sheet mt-10 max-w-3xl p-8 sm:p-10">
          {[0.7, 0.95, 0.88, 0.6, 0.92, 0.8, 0.5].map((w, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-full bg-morning-2 ${i === 0 ? "h-6" : "mt-4 h-3.5"}`}
              style={{ width: `${w * 100}%` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
