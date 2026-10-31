import { PageHeader } from "@/components/ui";
import { env } from "@/lib/core/config";
import { pageSession } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

const SECTIONS: Array<{ title: string; lines: string[] }> = [
  {
    title: "What Haazir does",
    lines: [
      "You tell Haazir about a patient who needs a bed. It phones the emergency desks of capable hospitals at the same time, writes each answer to the board as it is spoken, and shows you who said yes.",
      "You choose the hospital. Haazir then confirms the bed with that desk, sends the pre-arrival note and releases the others.",
    ],
  },
  {
    title: "When a call is automated",
    lines: [
      "Every call is made by an automated assistant. It says so at the start, says it is calling for you by name, and tells the person that the call is recorded.",
      "It reads the answer back and records it only after the desk confirms it. If the answer is unclear it says so; it never guesses a yes.",
      "It gives no medical advice, never promises payment and never claims to be a person.",
    ],
  },
  {
    title: "Who sees the patient's details",
    lines: [
      "The calls to hospitals carry no name, phone number or ID. Only the case, the acuity and what the patient needs are spoken.",
      "The patient's name and the attendant's details go to a hospital only after it has accepted, on WhatsApp.",
      "The family is messaged or called only if you recorded that the attendant agreed.",
      `Patient details, message texts and raw call logs are deleted ${env.retentionDays} days after a referral ends. The de-identified record stays, so the numbers on the analytics page remain.`,
    ],
  },
  {
    title: "What stays with you",
    lines: [
      "Haazir makes no medical decisions and takes no money for ranking hospitals. It orders them by travel time, past answers and how often the desk picks up.",
      "You can cancel, call a desk yourself or record what a desk told you at any time.",
    ],
  },
];

export default async function AboutPage() {
  await pageSession();
  return (
    <div className="max-w-2xl">
      <PageHeader title="About Haazir" description="What the calls say, who sees what, and what stays with you." />
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card px-5 py-4">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
              {s.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
