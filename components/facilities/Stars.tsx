import { Star } from "lucide-react";
import { shortCount, starFills } from "@/lib/ui/rating";

/** A hospital's Google rating as the usual five stars, the number and the review count, linking to the reviews. */
export function Stars({ rating, count, url, compact }: { rating: number; count: number; url: string | null; compact?: boolean }) {
  const label = `Rated ${rating.toFixed(1)} out of 5 on Google${count ? `, ${count} reviews` : ""}`;
  const body = (
    <span role="img" aria-label={label} className="inline-flex items-center gap-1.5">
      <span className="inline-flex">
        {starFills(rating).map((fill, i) => (
          <span key={i} className="relative inline-block size-3.5">
            <Star aria-hidden className="absolute inset-0 size-3.5 text-zinc-300" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star aria-hidden className="size-3.5 fill-yellow-500 text-yellow-500" />
            </span>
          </span>
        ))}
      </span>
      <span className="kbd-num text-sm font-semibold text-zinc-800">{rating.toFixed(1)}</span>
      {count > 0 && <span className="kbd-num text-xs text-zinc-500">({shortCount(count)})</span>}
      {!compact && <span className="text-[11px] text-zinc-400">Google</span>}
    </span>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline-offset-2 hover:underline">
      {body}
    </a>
  ) : (
    body
  );
}
