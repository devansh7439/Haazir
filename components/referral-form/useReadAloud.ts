import { useEffect, useState } from "react";

/** Reads the case summary aloud, as the desk would hear it. */
export function useReadAloud(text: string | null) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.onend = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  return { speaking, toggle, available: typeof window !== "undefined" && "speechSynthesis" in window };
}
