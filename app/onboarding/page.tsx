"use client";

/**
 * DEMO SCRIPT — to land on the seeded Ramirez household (with both episodes,
 * the flagged bill, and the pending episode suggestion all intact), type
 * these exact values. `MockWestyClient` matches Step 1 and each Step 2 entry
 * by position onto the seeded people, in order (see lib/mock/client.ts):
 *
 *   Step 1 (account):        Maria / Ramirez / 1985-03-12
 *   Step 2, in this order:   David / Ramirez / 1983-07-22
 *                            Sofia / Ramirez / 2017-11-02
 *                            Diego / Ramirez-Nunez / 2019-05-18
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NavBar,
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Tag,
  Button,
  Skeleton,
  SectionLabel,
  Field,
  TextInput,
  SegmentedControl,
} from "@westy/shared/ui";
import type { Document as WestyDocument, OnboardingSession, OnboardingStep } from "@westy/shared";
import { mockWestyClient } from "@/lib/mock";

type ConnectorKind = "payer" | "hsa_fsa_card" | "provider_portal";
type ConnectorState = {
  id: string;
  status: "pending" | "connected" | "error" | "disconnected";
  syncError?: string;
} | null;

type DocKind = "insurance_summary" | "eob" | "provider_bill";
type DocState = {
  id: string;
  status: WestyDocument["status"];
} | null;

const CONNECTOR_INFO: Record<ConnectorKind, { title: string; description: string; vendor: string }> = {
  payer: {
    title: "Insurance",
    description: "Connect your health plan to pull in claims and coverage automatically.",
    vendor: "Insurance Payer",
  },
  hsa_fsa_card: {
    title: "HSA / FSA card",
    description: "Link your card so eligible spending is tracked automatically.",
    vendor: "HSA/FSA Card",
  },
  provider_portal: {
    title: "Providers",
    description: "Connect a provider portal to pull in visit history.",
    vendor: "Provider Portal",
  },
};

const DOC_INFO: Record<DocKind, { title: string; description: string }> = {
  insurance_summary: {
    title: "Insurance Benefit Summary",
    description: "Your plan's summary of benefits and coverage.",
  },
  eob: {
    title: "EOBs",
    description: "Explanation of Benefits from a recent visit.",
  },
  provider_bill: {
    title: "Provider bills",
    description: "A bill from a doctor, hospital, or other provider.",
  },
};

function Header() {
  return <NavBar brand="Westy" links={[]} />;
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return <SectionLabel>Step {step} of 3</SectionLabel>;
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  // ── Step 1: Account ────────────────────────────────────────────────
  const [authMethod, setAuthMethod] = useState<"google" | "password">("google");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleCreateAccount() {
    setSubmitting(true);
    const resolvedEmail =
      authMethod === "google"
        ? `${firstName}.${lastName}@gmail.com`.toLowerCase()
        : email;
    const newSession = await mockWestyClient.startOnboarding({
      firstName,
      lastName,
      dateOfBirth,
      authProvider: authMethod,
      email: resolvedEmail,
    });
    setSession(newSession);
    setSubmitting(false);
    setStep(2);
  }

  const accountValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    dateOfBirth.trim() !== "" &&
    (authMethod === "google" || (email.trim() !== "" && password.trim() !== ""));

  // ── Step 2: Family members ───────────────────────────────────────────
  const [members, setMembers] = useState<{ firstName: string; lastName: string; dateOfBirth: string }[]>([]);
  const [draftFirstName, setDraftFirstName] = useState("");
  const [draftLastName, setDraftLastName] = useState("");
  const [draftDateOfBirth, setDraftDateOfBirth] = useState("");

  const draftValid = draftFirstName.trim() !== "" && draftLastName.trim() !== "" && draftDateOfBirth.trim() !== "";

  async function handleAddMember() {
    if (!session || !draftValid) return;
    setSubmitting(true);
    const input = { firstName: draftFirstName, lastName: draftLastName, dateOfBirth: draftDateOfBirth };
    const updated = await mockWestyClient.addFamilyMember(session.id, input);
    setSession(updated);
    setMembers((prev) => [...prev, input]);
    setDraftFirstName("");
    setDraftLastName("");
    setDraftDateOfBirth("");
    setSubmitting(false);
  }

  // ── Step 3: Connect or upload ─────────────────────────────────────────
  const [connectors, setConnectors] = useState<Record<ConnectorKind, ConnectorState>>({
    payer: null,
    hsa_fsa_card: null,
    provider_portal: null,
  });
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Record<DocKind, DocState>>({
    insurance_summary: null,
    eob: null,
    provider_bill: null,
  });
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const providerBillRef = useRef<HTMLDivElement>(null);

  function pollConnector(kind: ConnectorKind, id: string) {
    const interval = setInterval(async () => {
      const updated = await mockWestyClient.getConnector(id);
      setConnectors((prev) => ({
        ...prev,
        [kind]: { id: updated.id, status: updated.status, syncError: updated.syncError },
      }));
      if (updated.status !== "pending") clearInterval(interval);
    }, 500);
    intervalsRef.current.push(interval);
  }

  async function handleConnect(kind: ConnectorKind) {
    if (!session) return;
    const connector = await mockWestyClient.initiateConnector({
      ownerPersonId: session.userId,
      type: kind,
      vendor: CONNECTOR_INFO[kind].vendor,
    });
    setConnectors((prev) => ({ ...prev, [kind]: { id: connector.id, status: connector.status } }));
    setConnectorIds((prev) => [...prev, connector.id]);
    pollConnector(kind, connector.id);
  }

  function pollDocument(kind: DocKind, id: string) {
    const interval = setInterval(async () => {
      const updated = await mockWestyClient.getDocument(id);
      setDocuments((prev) => ({ ...prev, [kind]: { id: updated.id, status: updated.status } }));
      if (updated.status === "extracted" || updated.status === "failed") clearInterval(interval);
    }, 500);
    intervalsRef.current.push(interval);
  }

  async function handleUpload(kind: DocKind, file: File) {
    if (!session) return;
    const document = await mockWestyClient.uploadDocument({
      personId: session.userId,
      type: kind,
      file,
    });
    setDocuments((prev) => ({ ...prev, [kind]: { id: document.id, status: document.status } }));
    setDocumentIds((prev) => [...prev, document.id]);
    pollDocument(kind, document.id);
  }

  function scrollToProviderBillUpload() {
    providerBillRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const step3HasActivity = connectorIds.length > 0 || documentIds.length > 0;

  async function handleFinishStep3() {
    if (!session) return;
    setSubmitting(true);
    const finishedStep: OnboardingStep = {
      step: "connect_or_upload",
      status: step3HasActivity ? "complete" : "skipped",
      connectorIds,
      documentIds,
    };
    await mockWestyClient.advanceOnboardingStep(session.id, finishedStep);
    await mockWestyClient.completeOnboarding(session.id);
    setSubmitting(false);
    setStep("done");
  }

  return (
    <>
      <Header />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {step === 1 && (
          <>
            <StepIndicator step={1} />
            <Card>
              <CardTitle>Create your account</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <Field label="First name" htmlFor="firstName">
                  <TextInput id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field label="Last name" htmlFor="lastName">
                  <TextInput id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
                <Field label="Date of birth" htmlFor="dob">
                  <TextInput
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </Field>
                <SegmentedControl
                  name="authMethod"
                  value={authMethod}
                  onChange={(value) => setAuthMethod(value as "google" | "password")}
                  options={[
                    { value: "google", label: "Continue with Google" },
                    { value: "password", label: "Email & password" },
                  ]}
                />
                {authMethod === "password" && (
                  <>
                    <Field label="Email" htmlFor="email">
                      <TextInput
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                    <Field label="Password" htmlFor="password">
                      <TextInput
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Button variant="primary" disabled={!accountValid || submitting} onClick={handleCreateAccount}>
                  {authMethod === "google" ? "Continue with Google" : "Create account"}
                </Button>
              </div>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <StepIndicator step={2} />
            <Card>
              <CardTitle>Add family members</CardTitle>
              <CardBody>Add anyone else in your household you&apos;d like Westy to help manage care for.</CardBody>
            </Card>

            {members.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {members.map((member, i) => (
                  <Card key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <CardBody>
                      {member.firstName} {member.lastName}
                    </CardBody>
                    <CardMeta>{member.dateOfBirth}</CardMeta>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardKicker>New family member</CardKicker>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <Field label="First name" htmlFor="memberFirstName">
                  <TextInput
                    id="memberFirstName"
                    value={draftFirstName}
                    onChange={(e) => setDraftFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Last name" htmlFor="memberLastName">
                  <TextInput
                    id="memberLastName"
                    value={draftLastName}
                    onChange={(e) => setDraftLastName(e.target.value)}
                  />
                </Field>
                <Field label="Date of birth" htmlFor="memberDob">
                  <TextInput
                    id="memberDob"
                    type="date"
                    value={draftDateOfBirth}
                    onChange={(e) => setDraftDateOfBirth(e.target.value)}
                  />
                </Field>
                <Button variant="secondary" disabled={!draftValid || submitting} onClick={handleAddMember}>
                  Add another
                </Button>
              </div>
            </Card>

            <Button variant="primary" onClick={() => setStep(3)}>
              Continue
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <StepIndicator step={3} />
            <Card>
              <CardTitle>Connect your accounts</CardTitle>
              <CardBody>
                Connect your insurance, HSA/FSA card, or providers to pull in your records automatically — or upload
                documents instead. Both are optional.
              </CardBody>
            </Card>

            <section>
              <SectionLabel>Connect</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {(Object.keys(CONNECTOR_INFO) as ConnectorKind[]).map((kind) => {
                  const info = CONNECTOR_INFO[kind];
                  const state = connectors[kind];
                  return (
                    <Card key={kind}>
                      <CardKicker>{info.title}</CardKicker>
                      <CardBody>{info.description}</CardBody>
                      {!state && (
                        <div>
                          <Button variant="secondary" onClick={() => handleConnect(kind)}>
                            Connect {info.title}
                          </Button>
                        </div>
                      )}
                      {state?.status === "pending" && <Skeleton height={36} />}
                      {state?.status === "connected" && (
                        <div style={{ alignSelf: "flex-start" }}>
                          <Tag variant="neutral">Connected</Tag>
                        </div>
                      )}
                      {state?.status === "error" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          <div style={{ alignSelf: "flex-start" }}>
                            <Tag variant="accent">Couldn&apos;t connect</Tag>
                          </div>
                          <CardMeta>{state.syncError}</CardMeta>
                          {kind === "provider_portal" && (
                            <div>
                              <Button variant="ghost" onClick={scrollToProviderBillUpload}>
                                Upload a document instead
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>

            <section>
              <SectionLabel>Upload</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {(Object.keys(DOC_INFO) as DocKind[]).map((kind) => {
                  const info = DOC_INFO[kind];
                  const state = documents[kind];
                  return (
                    <div key={kind} ref={kind === "provider_bill" ? providerBillRef : undefined}>
                      <Card>
                        <CardKicker>{info.title}</CardKicker>
                        <CardBody>{info.description}</CardBody>
                        {!state && (
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(kind, file);
                            }}
                          />
                        )}
                        {state && (state.status === "uploaded" || state.status === "processing") && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                            <div style={{ alignSelf: "flex-start" }}>
                              <Tag variant="neutral">{state.status === "uploaded" ? "Uploaded" : "Processing"}</Tag>
                            </div>
                            <Skeleton height={24} />
                          </div>
                        )}
                        {state?.status === "extracted" && (
                          <div style={{ alignSelf: "flex-start" }}>
                            <Tag variant="neutral">Processed</Tag>
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </section>

            <Button variant="primary" disabled={submitting} onClick={handleFinishStep3}>
              {step3HasActivity ? "Continue" : "Skip for now"}
            </Button>
          </>
        )}

        {step === "done" && (
          <Card>
            <CardTitle>Congratulations, you&apos;re all set!</CardTitle>
            <CardBody>Your household is ready. Westy will start organizing your care from here.</CardBody>
            <div>
              <Button variant="primary" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
