import { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../../api/client";
import { CreatedSchema, type Acuity, type AgeUnit, type Bootstrap, type CaseTemplate, type Sex } from "../../api/schema";
import { newRequestId } from "../../lib/request-id";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { Screen } from "../../ui/Screen";
import { color, font } from "../../ui/theme";
import { CallPreview } from "./CallPreview";
import { CasePicker } from "./CasePicker";
import { NeedsPicker } from "./NeedsPicker";
import { PatientDetails } from "./PatientDetails";
import { PatientSection } from "./PatientSection";
import { DEFAULT_RADIUS_KM, RADII_KM } from "./options";
import { EMPTY_PATIENT, type PatientFields } from "./types";
import { useOrigin } from "./useOrigin";
import { useReferralPreview } from "./useReferralPreview";

/** What the form still needs before it can be sent, as the hint under the button; null when nothing is missing. */
const missingStep = (caseType: string, acuity: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : !acuity ? "Set how urgent it is" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

/** The "Find a bed" form, with a live preview of what hospitals will hear and who will be phoned. */
export function ReferralForm({ boot, onCreated }: { boot: Bootstrap; onCreated: (id: string) => void }) {
  const referrer = boot.referrer;
  const [caseType, setCaseType] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [acuity, setAcuity] = useState<Acuity | "">("");
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("years");
  const [sex, setSex] = useState<Sex>("unknown");
  const [note, setNote] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [showPatient, setShowPatient] = useState(false);
  const [patient, setPatient] = useState<PatientFields>(EMPTY_PATIENT);
  // One id per form: a double tap or a retry after a network error reuses it, so hospitals are never called twice
  // for the same patient.
  const [requestId] = useState(newRequestId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loc = useOrigin();

  const pick = (t: CaseTemplate) => {
    setCaseType(t.case_type);
    setNeeds(t.default_capabilities);
  };
  const toggleNeed = (code: string) => setNeeds((n) => (n.includes(code) ? n.filter((c) => c !== code) : [...n, code]));

  const body = useMemo(
    () => ({
      referrer_id: referrer?.id ?? "",
      case_type: caseType,
      required_capabilities: needs,
      acuity: acuity || "critical",
      age_value: age === "" ? null : Number(age),
      age_unit: ageUnit,
      sex,
      note: note.trim() || null,
      transport: "ambulance" as const,
      search_radius_km: radius,
      ...(loc.origin ? { origin_lat: loc.origin.lat, origin_lng: loc.origin.lng } : {}),
    }),
    [referrer?.id, caseType, needs, acuity, age, ageUnit, sex, note, radius, loc.origin],
  );
  const { preview, error: previewError, loading } = useReferralPreview(referrer ? body : {}, referrer ? caseType : "");

  const noteErrors = preview?.errors ?? [];
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  const ageOk = age === "" || /^\d{1,3}$/.test(age);
  const missing = missingStep(caseType, acuity, needs);
  const canSubmit = !!referrer && !missing && noteErrors.length === 0 && willCall.length > 0 && ageOk && !submitting && boot.bolna_ready;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const filled = showPatient || patient.patient_name || patient.attendant_phone;
      const created = await api("/api/referrals", CreatedSchema, {
        body: { ...body, client_request_id: requestId, patient: filled ? { ...patient, attendant_language: patient.attendant_language || null } : undefined },
      });
      onCreated(created.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start the referral");
      setSubmitting(false);
    }
  }

  if (!referrer) {
    return (
      <Screen title="New referral" testID="new-referral">
        <Callout kind="warn" title="No referring doctor">No referring doctor is set up for this account. Ask an admin to add one.</Callout>
      </Screen>
    );
  }

  const hint = missing ?? (willCall.length === 0 && preview ? "No hospital to call" : !boot.bolna_ready ? "Calls are off on this server" : `Phones ${willCall.length} hospital${willCall.length === 1 ? "" : "s"} at once`);
  return (
    <Screen
      title="New referral"
      subtitle={`Referring as ${referrer.name}${referrer.facility ? ` · ${referrer.facility}` : ""}`}
      testID="new-referral"
      footer={
        <>
          {submitError ? <Callout kind="error">{submitError}</Callout> : null}
          <Button label="Find a bed" icon="phone-call" variant="primary" loading={submitting} disabled={!canSubmit} onPress={submit} testID="find-a-bed" />
          <Text style={styles.hint}>{hint}</Text>
        </>
      }
    >
      <Card style={{ gap: 20 }}>
        <CasePicker templates={boot.templates} caseType={caseType} onPick={pick} />
        <NeedsPicker capabilities={boot.capabilities} needs={needs} onToggle={toggleNeed} />
        <PatientSection
          acuity={acuity}
          onAcuity={setAcuity}
          age={age}
          onAge={setAge}
          ageUnit={ageUnit}
          onAgeUnit={setAgeUnit}
          sex={sex}
          onSex={setSex}
          note={note}
          onNote={setNote}
          noteErrors={noteErrors}
          warnings={preview?.warnings ?? []}
        />
        <PatientDetails open={showPatient} onToggle={() => setShowPatient((s) => !s)} patient={patient} onChange={setPatient} />
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Search distance</Text>
          <View style={styles.row}>
            {RADII_KM.map((km) => <Chip key={km} label={`${km} km`} selected={km === radius} onPress={() => setRadius(km)} />)}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Start from my location</Text>
              <Text style={styles.hint}>{loc.origin ? "Using this phone's position." : "Otherwise the search starts from your centre."}</Text>
            </View>
            <Switch
              accessibilityLabel="Start from my location"
              value={!!loc.origin || loc.busy}
              disabled={loc.busy}
              onValueChange={(on) => (on ? void loc.enable() : loc.disable())}
              trackColor={{ true: color.brand }}
            />
          </View>
          {loc.error ? <Callout kind="warn">{loc.error}</Callout> : null}
        </View>
      </Card>
      <CallPreview preview={preview} loading={loading} error={previewError} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  hint: { fontSize: font.xs, color: color.muted, textAlign: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  switchTitle: { fontSize: font.md, fontWeight: "600", color: color.text },
});
