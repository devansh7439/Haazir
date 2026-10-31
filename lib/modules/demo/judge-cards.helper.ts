// Judge cards (docs/08-demo-and-pitch.md §2), keyed to the demo facilities so each card prints with its phone number.

export interface JudgeCard {
  card: number;
  facility_id: string;
  role: string;
  language: string;
  lines: string[];
}

/** The printed cards for the people playing the hospital desks in the stage demo. */
export const JUDGE_CARDS: JudgeCard[] = [
  {
    card: 1, facility_id: "00000000-0000-4000-8000-000000000103", role: "casualty desk", language: "Kannada speaker needed",
    lines: [
      "Answer in Kannada. You have an ICU bed with a ventilator free.",
      "Accept, with a condition: “ರೋಗಿಯ ಜೊತೆ ಪಿಎಚ್‌ಸಿ ಕೇಸ್ ಶೀಟ್ ಕಳುಹಿಸಿ” (send the PHC case sheet with the patient). Ready in 10 minutes. Your name: Dr Shashikala.",
      "A minute later you'll get a confirmation call: say yes, keep the bed ready. Then check WhatsApp.",
    ],
  },
  {
    card: 2, facility_id: "00000000-0000-4000-8000-000000000101", role: "casualty desk", language: "English",
    lines: [
      "Accept. ICU bed with ventilator free, ready in 10 minutes, ask for Dr Kiran.",
      "Later you'll get a short call saying the patient went elsewhere: just say “OK, thanks”.",
    ],
  },
  {
    card: 3, facility_id: "00000000-0000-4000-8000-000000000102", role: "casualty desk", language: "English",
    lines: ["Decline: “Sorry, our ICU is full, no ventilator free.”"],
  },
  {
    card: 4, facility_id: "00000000-0000-4000-8000-000000000105", role: "casualty desk", language: "English",
    lines: [
      "Before deciding, ask: “Can I speak to the referring doctor? Is the patient intubated?”",
      "The doctor will call you back on stage. Answer and chat for 10 seconds.",
    ],
  },
  {
    card: 5, facility_id: "00000000-0000-4000-8000-000000000104", role: "referral desk", language: "English",
    lines: [
      "Say “Hold on, let me check the ICU.” Stay silent for about 10 seconds.",
      "Then accept: ICU with ventilator, ready in 20 minutes, ask for Nurse Priya.",
      "Later you'll get a short call saying the patient went elsewhere.",
    ],
  },
  {
    card: 6, facility_id: "00000000-0000-4000-8000-000000000106", role: "casualty desk", language: "Hindi",
    lines: ["Don't answer when it rings."],
  },
];
