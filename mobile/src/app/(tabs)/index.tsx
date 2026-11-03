import { router } from "expo-router";
import { useState } from "react";
import { ReferralForm } from "../../features/referral-form/ReferralForm";
import { useSignedIn } from "../../session/SessionProvider";

/** The first tab: start a referral. After "Find a bed" the form resets and the live board opens. */
export default function NewReferral() {
  const { boot } = useSignedIn();
  const [formKey, setFormKey] = useState(0);
  return (
    <ReferralForm
      key={formKey}
      boot={boot}
      onCreated={(id) => {
        router.push(`/referral/${id}`);
        setFormKey((k) => k + 1);
      }}
    />
  );
}
