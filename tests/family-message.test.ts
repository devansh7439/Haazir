import { describe, expect, it } from "vitest";
import { familyMessage, type HandoffFacts } from "@/lib/modules/handoff/message.helper";

// The exact words the family receives. A reworded template must be a deliberate change, reviewed by a native speaker.

const facts = {
  code: "R-4821", doctor_name: "Dr. Meera Rao", hospital_name: "Tamarind District Hospital", hospital_address: "12 MG Road, Bengaluru",
  hospital_lat: 12.97, hospital_lng: 77.59, contact_person: "Dr Kiran",
} as HandoffFacts;
const bare = { ...facts, hospital_address: "", contact_person: null } as HandoffFacts;

describe("familyMessage", () => {
  it("says the same words in English, Kannada and Hindi", () => {
    expect(familyMessage(facts, "en").body).toBe("Haazir referral R-4821: Dr. Meera Rao has arranged treatment for the patient at Tamarind District Hospital. Address: 12 MG Road, Bengaluru. Map: https://www.google.com/maps/search/?api=1&query=12.97,77.59. Show this message at the casualty desk and ask for Dr Kiran.");
    expect(familyMessage(facts, "kn").body).toBe("ಹಾಜಿರ್ ರೆಫರಲ್ R-4821: ಡಾ. Meera Rao ಅವರು ರೋಗಿಗೆ Tamarind District Hospital ನಲ್ಲಿ ಚಿಕಿತ್ಸೆಯ ವ್ಯವಸ್ಥೆ ಮಾಡಿದ್ದಾರೆ. ವಿಳಾಸ: 12 MG Road, Bengaluru. ನಕ್ಷೆ: https://www.google.com/maps/search/?api=1&query=12.97,77.59. ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್‌ನಲ್ಲಿ ಈ ಸಂದೇಶವನ್ನು ತೋರಿಸಿ ಮತ್ತು Dr Kiran ಅವರನ್ನು ಕೇಳಿ.");
    expect(familyMessage(facts, "hi").body).toBe("हाज़िर रेफ़रल R-4821: डॉ. Meera Rao ने मरीज़ के इलाज की व्यवस्था Tamarind District Hospital में की है। पता: 12 MG Road, Bengaluru। नक्शा: https://www.google.com/maps/search/?api=1&query=12.97,77.59। कैज़ुअल्टी डेस्क पर यह संदेश दिखाएँ और Dr Kiran से मिलें।");
  });

  it("falls back to English for an unsupported language, and to the casualty desk when no name is known", () => {
    expect(familyMessage(facts, "xx").body).toBe("Haazir referral R-4821: Dr. Meera Rao has arranged treatment for the patient at Tamarind District Hospital. Address: 12 MG Road, Bengaluru. Map: https://www.google.com/maps/search/?api=1&query=12.97,77.59. Show this message at the casualty desk and ask for Dr Kiran.");
    expect(familyMessage(bare, "kn").body).toBe("ಹಾಜಿರ್ ರೆಫರಲ್ R-4821: ಡಾ. Meera Rao ಅವರು ರೋಗಿಗೆ Tamarind District Hospital ನಲ್ಲಿ ಚಿಕಿತ್ಸೆಯ ವ್ಯವಸ್ಥೆ ಮಾಡಿದ್ದಾರೆ. ವಿಳಾಸ: Tamarind District Hospital. ನಕ್ಷೆ: https://www.google.com/maps/search/?api=1&query=12.97,77.59. ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್‌ನಲ್ಲಿ ಈ ಸಂದೇಶವನ್ನು ತೋರಿಸಿ ಮತ್ತು ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್ ಅವರನ್ನು ಕೇಳಿ.");
  });
});
