/** Shown inside the shell the moment a link is clicked, while the next page's data loads. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-5">
      <div className="h-7 w-48 rounded-lg bg-zinc-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-zinc-100" />
    </div>
  );
}
