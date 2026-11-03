import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { Draft } from "../../api/schema";
import { DraftsList } from "../../features/referral-form/DraftsList";
import { ReferralForm } from "../../features/referral-form/ReferralForm";
import { useSignedIn } from "../../session/SessionProvider";
import { color } from "../../ui/theme";

/** The first tab: start a referral. Drafts from WhatsApp pre-fill it. After "Find a bed" the form resets and the live board opens. */
export default function NewReferral() {
  const { boot } = useSignedIn();
  const [formKey, setFormKey] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ReferralForm
        key={`${formKey}-${draft?.id ?? "new"}`}
        boot={boot}
        draft={draft}
        header={draft ? undefined : <DraftsList onReview={setDraft} />}
        onCreated={(id) => {
          router.push(`/referral/${id}`);
          setDraft(null);
          setFormKey((k) => k + 1);
        }}
      />
    </View>
  );
}
