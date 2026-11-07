import { ShieldCheck } from "lucide-react";
import { CONTACT_STALE_AFTER_DAYS, contactFreshness } from "@/lib/modules/facility/freshness.helper";

/** "verified" for a number checked recently, a warning for one not checked in a while, and nothing for one never checked. */
export function ContactFreshness({ verifiedAt }: { verifiedAt: string | null }) {
  const freshness = contactFreshness(verifiedAt, Date.now());
  if (freshness === "fresh") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <ShieldCheck aria-hidden className="size-3.5" />
        verified
      </span>
    );
  }
  if (freshness === "stale") return <span className="tag bg-amber-50 text-amber-800">not checked in {CONTACT_STALE_AFTER_DAYS}+ days</span>;
  return null;
}
