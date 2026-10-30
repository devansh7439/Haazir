import { redactNumbers } from "@/lib/core/normalize";

// Structured server logs. Fields must never hold patient or attendant identifiers (CLAUDE.md rule 1).

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

export interface Logger {
  info(fields: Fields, message: string): void;
  warn(fields: Fields, message: string): void;
  error(fields: Fields, message: string): void;
}

/** An error as text: its message only (no stack), with phone numbers masked, since provider errors can echo the number dialled. */
export const describeError = (err: unknown): string => redactNumbers(err instanceof Error ? err.message : String(err));

const write = (level: Level, scope: string, fields: Fields, message: string): void => {
  const { err, ...rest } = fields;
  const extra = err === undefined ? rest : { ...rest, err: describeError(err) };
  const line = `[haazir:${scope}] ${message}`;
  if (Object.keys(extra).length === 0) console[level](line);
  else console[level](line, extra);
};

/** A logger for one area of the app, e.g. createLogger("call"). An `err` field is reduced by describeError. */
export const createLogger = (scope: string): Logger => ({
  info: (fields, message) => write("info", scope, fields, message),
  warn: (fields, message) => write("warn", scope, fields, message),
  error: (fields, message) => write("error", scope, fields, message),
});
