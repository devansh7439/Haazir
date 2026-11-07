import Link from "next/link";
import { ReferralStatusPill, StatusPill } from "@/components/ui";
import { attentionOf, attentionText, type Attention } from "@/lib/modules/referral/queue.helper";
import type { QueueItem } from "@/lib/modules/referral/view.type";
import type { IconKey, Tone } from "@/lib/ui/display";
import { mmss } from "@/lib/ui/display";

const ATTENTION_LOOK: Record<Attention, { tone: Tone; icon: IconKey }> = {
  doctor: { tone: "red", icon: "phone" },
  exhausted: { tone: "red", icon: "x" },
  choose: { tone: "green", icon: "check" },
  review: { tone: "orange", icon: "help" },
};

/** One live referral on the queue: what it is, who it is for, how its calls stand and what a person must do next. */
export function QueueRow({ item, waitingSeconds }: { item: QueueItem; waitingSeconds: number }) {
  const attention = attentionOf(item);
  return (
    <li>
      <Link
        href={`/referrals/${item.id}`}
        className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-sm hover:bg-zinc-50 md:grid-cols-[5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_4rem]"
      >
        <span className="kbd-num font-medium text-zinc-900">{item.code}</span>
        <span className="min-w-0">
          <span className="block truncate text-zinc-900">
            {item.case_label} <span className="text-zinc-400">· {item.acuity}</span>
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {item.referrer_name}
            {item.entered_by_name && ` · keyed in by ${item.entered_by_name}`}
          </span>
        </span>
        <span className="col-span-2 text-xs text-zinc-600 md:col-span-1">
          {item.calls_open} calling · {item.calls_answered} answered · {item.calls_accepted} yes
        </span>
        <span className="col-span-2 md:col-span-1">
          {attention ? (
            <StatusPill {...ATTENTION_LOOK[attention]} text={attentionText(attention, item)} size="sm" />
          ) : (
            <ReferralStatusPill status={item.status} size="sm" />
          )}
        </span>
        <span className="kbd-num hidden text-right text-zinc-500 md:block" title="Time since it started">
          {mmss(waitingSeconds)}
        </span>
      </Link>
    </li>
  );
}
