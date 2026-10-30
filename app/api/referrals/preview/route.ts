import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { previewReferral } from "@/lib/orchestrator";
import { AppError } from "@/lib/repo";
import { PreviewBody } from "@/lib/validation";

// Builds the spoken summary and lists eligible hospitals without creating anything.
export async function POST(req: Request) {
  return handle(async () => {
    const input = await parseBody(req, PreviewBody);
    try {
      return NextResponse.json(await previewReferral(input));
    } catch (err) {
      // The form shows note problems inline instead of failing the whole preview.
      if (err instanceof AppError && err.code === "NOTE_CONTAINS_IDENTIFIER") {
        return NextResponse.json({ spoken_summary: null, warnings: [], errors: err.details.errors ?? [err.message], eligible: [], suggestions: [] });
      }
      throw err;
    }
  });
}
