import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/core/error";
import { createLogger, describeError } from "@/lib/core/logger";

describe("ApiError", () => {
  it("keeps each status and the codes the console relies on", () => {
    const cases: Array<[ApiError, number, string]> = [
      [ApiError.badRequest("INVALID_JSON", "x"), 400, "INVALID_JSON"],
      [ApiError.unauthorized("x"), 401, "UNAUTHORIZED"],
      [ApiError.forbidden("x"), 403, "FORBIDDEN"],
      [ApiError.notFound("x"), 404, "NOT_FOUND"],
      [ApiError.conflict("NOT_SELECTABLE", "x"), 409, "NOT_SELECTABLE"],
      [ApiError.unsupportedMediaType("x"), 415, "UNSUPPORTED_MEDIA_TYPE"],
      [ApiError.unprocessable("BAD_NUMBER", "x"), 422, "BAD_NUMBER"],
      [ApiError.tooMany("REDIAL_LIMIT", "x"), 429, "REDIAL_LIMIT"],
      [ApiError.internal("INSERT_FAILED", "x"), 500, "INSERT_FAILED"],
    ];
    for (const [err, status, code] of cases) {
      expect(err).toBeInstanceOf(ApiError);
      expect([err.status, err.code, err.message]).toEqual([status, code, "x"]);
    }
    expect(ApiError.unprocessable("UNKNOWN_CAPABILITY", "x", { unknown: ["icu"] }).details).toEqual({ unknown: ["icu"] });
  });
});

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reduces an error to its message with phone numbers masked", () => {
    expect(describeError(new Error("Bolna 400: +91 98450 12345 is not reachable"))).not.toMatch(/98450|12345/);
    expect(describeError("plain text")).toBe("plain text");
  });

  it("writes the scope, the message and the fields, never a stack or a phone number", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger("call").error({ err: new Error("dial +919845012345 failed"), referralId: "r1" }, "Status poll failed");
    expect(spy).toHaveBeenCalledTimes(1);
    const [line, fields] = spy.mock.calls[0] as [string, Record<string, unknown>];
    expect(line).toBe("[haazir:call] Status poll failed");
    expect(fields.referralId).toBe("r1");
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/9845012345|at Object|\.ts:\d+/);
  });

  it("writes only the line when there are no fields", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    createLogger("cron").warn({}, "Nothing to do");
    expect(spy).toHaveBeenCalledWith("[haazir:cron] Nothing to do");
  });
});
