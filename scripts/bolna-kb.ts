// Builds the agents' knowledge base from bolna/knowledge/desk-faq.md and uploads it to Bolna.
//
//   bun run bolna:kb                → dry run: writes bolna/generated/desk-faq.pdf for review
//   bun run bolna:kb -- --upload    → POST /knowledgebase, waits until processed, prints BOLNA_KNOWLEDGE_BASE_ID
//
// Bolna ingests PDFs (or public URLs, which a local-only setup doesn't have), so the text is printed to PDF with a
// local Edge or Chrome in headless mode; set BROWSER_PATH if neither is in the usual place.
// Small chunks and a low top-k keep each retrieval short: every extra token is latency on an emergency call.
// Then: bun run bolna:agents -- --update  (with BOLNA_KNOWLEDGE_BASE_ID set, or --kb <rag_id>).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = path.join("bolna", "knowledge", "desk-faq.md");
const OUT_DIR = path.join("bolna", "generated");
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const CHUNK = { chunk_size: "256", overlapping: "32", similarity_top_k: "4", language_support: "multilingual" };
const WAIT_S = 180;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Prints the knowledge text to a PDF with a headless browser. Throws when no browser is found or printing fails. */
function buildPdf(): string {
  const browser = [process.env.BROWSER_PATH, ...BROWSERS].find((p): p is string => !!p && fs.existsSync(p));
  if (!browser) throw new Error("No Edge or Chrome found; set BROWSER_PATH");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = path.resolve(OUT_DIR, "desk-faq.html");
  const pdf = path.resolve(OUT_DIR, "desk-faq.pdf");
  // Nirmala UI covers Devanagari and Kannada on Windows; Noto covers them elsewhere.
  const style = "font-family:'Nirmala UI','Noto Sans','Noto Sans Devanagari','Noto Sans Kannada',sans-serif;font-size:11pt;white-space:pre-wrap";
  const text = fs.readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
  fs.writeFileSync(html, `<!DOCTYPE html><meta charset="utf-8"><body><pre style="${style}">${escapeHtml(text)}</pre></body>`);
  fs.rmSync(pdf, { force: true });
  const args = ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, pathToFileURL(html).href];
  const run = spawnSync(browser, args, { encoding: "utf8", timeout: 60_000 });
  if (!fs.existsSync(pdf)) throw new Error(`Printing the PDF failed: ${(run.stderr ?? "").slice(0, 300)}`);
  return pdf;
}

async function main() {
  const pdf = buildPdf();
  console.log(`wrote ${pdf} (${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
  if (!process.argv.includes("--upload")) {
    console.log("\nDry run only. Open the PDF to check it, then rerun with --upload.");
    return;
  }
  const key = (process.env.BOLNA_API_KEY ?? "").trim();
  if (!key) throw new Error("Set BOLNA_API_KEY for --upload");
  const base = (process.env.BOLNA_BASE_URL ?? "").trim() || "https://api.bolna.ai";
  const headers = { Authorization: `Bearer ${key}` };

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(pdf)], { type: "application/pdf" }), "haazir-desk-faq.pdf");
  for (const [k, v] of Object.entries(CHUNK)) form.append(k, v);
  const res = await fetch(`${base}/knowledgebase`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bolna returned ${res.status}: ${text.slice(0, 500)}`);
  const created = JSON.parse(text) as { rag_id?: string; status?: string };
  if (!created.rag_id) throw new Error(`No rag_id in Bolna's answer: ${text.slice(0, 300)}`);
  console.log(`uploaded: ${created.rag_id} (${created.status ?? "?"})`);

  let status = created.status ?? "processing";
  for (let waited = 0; status === "processing" && waited < WAIT_S; waited += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${base}/knowledgebase/${created.rag_id}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (poll.ok) status = ((await poll.json()) as { status?: string }).status ?? status;
  }
  if (status !== "processed") throw new Error(`Knowledge base ${created.rag_id} is "${status}" after ${WAIT_S} s; check the Bolna dashboard`);
  console.log(`\nprocessed. Add to your environment:\nBOLNA_KNOWLEDGE_BASE_ID=${created.rag_id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
