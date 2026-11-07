import { useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
type SpeechWindow = { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };

/** Dictation, where the browser has it. A doctor on a ward round can speak the referral instead of typing it. */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => {
    const w = window as unknown as SpeechWindow;
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  const toggle = () => {
    if (listening) return rec.current?.stop();
    const w = window as unknown as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results, (res) => res[0]?.transcript ?? "").join(" ").trim());
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  return { supported, listening, toggle };
}
