import { CheckCircle2, Webhook, XCircle } from "lucide-react";
import { ago } from "@/lib/ui/demo";
import type { DemoStatus } from "./types";
import { Panel } from "./Panel";

export function ConnectionPanel({ status, onRefresh }: { status: DemoStatus; onRefresh: () => void }) {
  const c = status.config;
  const configRows: Array<[string, boolean, string]> = [
    ["Bolna API key", c.bolna_api_key, "BOLNA_API_KEY"],
    ["Availability agent", c.availability_agent, "BOLNA_AGENT_ID_AVAILABILITY"],
    ["Hold-confirm agent", c.hold_confirm_agent, "BOLNA_AGENT_ID_HOLD_CONFIRM"],
    ["Release agent", c.release_agent, "BOLNA_AGENT_ID_RELEASE"],
    ["Webhook secret", c.webhook_secret, "BOLNA_WEBHOOK_SECRET"],
    ["Function secret", c.function_secret, "BOLNA_FUNCTION_SECRET"],
    ["Indian caller ID", c.from_number, "BOLNA_FROM_NUMBER"],
  ];

  return (
    <Panel title="Connection" description="Can Bolna reach this app?" action={<button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={onRefresh}>Refresh</button>}>
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
        <div className="px-5 py-3">
          <div className="eyebrow flex items-center gap-1"><Webhook aria-hidden className="size-3.5" />Last webhook</div>
          <div className="mt-1 text-sm font-semibold">{ago(status.last_webhook_at)}</div>
        </div>
        <div className="px-5 py-3">
          <div className="eyebrow">Last function call</div>
          <div className="mt-1 text-sm font-semibold">{ago(status.last_function_at)}</div>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {configRows.map(([label, ok, envName]) => (
          <li key={envName} className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
            {ok ? <CheckCircle2 aria-label="set" className="size-4 text-emerald-600" /> : <XCircle aria-label="missing" className="size-4 text-zinc-300" />}
            <span className="flex-1 text-zinc-800">{label}</span>
            <code className="text-[11px] text-zinc-400">{envName}</code>
          </li>
        ))}
        <li className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />
          <span className="flex-1 text-zinc-800">WhatsApp provider</span>
          <span className="tag">{c.whatsapp_provider}</span>
        </li>
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-zinc-500">
        Agent webhook: <code className="break-all">{c.app_base_url ? `${c.app_base_url}/api/bolna/webhook?token=…` : "set APP_BASE_URL"}</code>
      </p>
    </Panel>
  );
}
