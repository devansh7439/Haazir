import "server-only";
import { env } from "@/lib/core/config";
import { readText } from "@/lib/core/normalize";

// Voice-note download and speech-to-text for WhatsApp intake (C2).
// VERIFY: Sarvam's speech-to-text request shape (multipart file + model + language_code, header api-subscription-key)
// is from its docs at the time of writing; they weren't reachable from the build environment.

/** The voice note behind a Twilio media URL, with its content type. Throws when Twilio refuses. */
export async function downloadTwilioMedia(url: string): Promise<{ data: ArrayBuffer; type: string }> {
  const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Twilio media download failed: ${res.status}`);
  return { data: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "audio/ogg" };
}

/** The voice note behind a Meta media id (a lookup, then the download), with its content type. Throws when Meta refuses. */
export async function downloadMetaMedia(mediaId: string): Promise<{ data: ArrayBuffer; type: string }> {
  const version = env.metaGraphVersion || "v21.0";
  const meta = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${env.metaToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!meta.ok) throw new Error(`Meta media lookup failed: ${meta.status}`);
  const info: unknown = await meta.json().catch(() => null);
  const url = readText(info, "url");
  if (!url) throw new Error("Meta media lookup gave no download address");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.metaToken}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Meta media download failed: ${res.status}`);
  return { data: await res.arrayBuffer(), type: readText(info, "mime_type") ?? res.headers.get("content-type") ?? "audio/ogg" };
}

/** Transcribes Indian-language speech (code-mixed is fine). Returns null when STT isn't configured. */
export async function transcribe(audio: { data: ArrayBuffer; type: string }): Promise<string | null> {
  if (!env.sarvamApiKey) return null;
  const form = new FormData();
  const ext = audio.type.includes("mpeg") ? "mp3" : audio.type.includes("wav") ? "wav" : "ogg";
  form.append("file", new Blob([audio.data], { type: audio.type }), `voice-note.${ext}`);
  form.append("model", env.sarvamSttModel);
  form.append("language_code", "unknown");
  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": env.sarvamApiKey },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Speech-to-text failed: ${res.status}`);
  const transcript = readText(await res.json().catch(() => null), "transcript");
  return transcript?.trim() || null;
}
