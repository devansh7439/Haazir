export function Rate({ n, d }: { n: number; d: number }) {
  if (d === 0) return <span className="text-zinc-400">—</span>;
  const pct = Math.round((100 * n) / d);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="kbd-num text-xs text-zinc-600">{pct}% <span className="text-zinc-400">({n}/{d})</span></span>
    </div>
  );
}
