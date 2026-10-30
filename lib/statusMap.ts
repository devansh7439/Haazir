// Bolna execution status → our attempt status, with monotonic ordering (docs/02-architecture.md §5.3).

import type { AttemptStatus } from "./types";

export const TERMINAL: ReadonlySet<AttemptStatus> = new Set(["completed", "no_answer", "busy", "failed", "canceled"]);

const RANK: Record<AttemptStatus, number> = {
  queued: 0,
  dialing: 1,
  ringing: 2,
  in_progress: 3,
  wrapping_up: 4,
  completed: 5,
  no_answer: 5,
  busy: 5,
  failed: 5,
  canceled: 5,
};

export type StatusAlert = "guardrails_rescheduled" | "balance_low" | null;

export interface MappedStatus {
  status: AttemptStatus;
  alert: StatusAlert;
}

export function mapBolnaStatus(raw: string | null | undefined): MappedStatus | null {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "scheduled":
    case "queued":
      return { status: "queued", alert: null };
    case "rescheduled":
      return { status: "queued", alert: "guardrails_rescheduled" };
    case "initiated":
      return { status: "dialing", alert: null };
    case "ringing":
      return { status: "ringing", alert: null };
    case "in-progress":
    case "in_progress":
      return { status: "in_progress", alert: null };
    case "call-disconnected":
      return { status: "wrapping_up", alert: null };
    case "completed":
      return { status: "completed", alert: null };
    case "no-answer":
    case "no_answer":
      return { status: "no_answer", alert: null };
    case "busy":
      return { status: "busy", alert: null };
    case "failed":
    case "error":
      return { status: "failed", alert: null };
    case "balance-low":
      return { status: "failed", alert: "balance_low" };
    case "canceled":
    case "cancelled":
    case "stopped":
      return { status: "canceled", alert: null };
    default:
      return null;
  }
}

export function isTerminal(s: AttemptStatus): boolean {
  return TERMINAL.has(s);
}

/**
 * Monotonic rule: only move forward. Once terminal, nothing changes.
 * From wrapping_up (call-disconnected) only completed — or failed if Bolna reports an error — is allowed.
 */
export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false;
  if (from === "wrapping_up") return to === "completed" || to === "failed";
  return RANK[to] > RANK[from];
}
