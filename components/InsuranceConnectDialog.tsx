"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AiSurface, Button, Dialog, Field, Tag, TextInput } from "@westy/shared/ui";
import { DEMO_PAYER_PLAN_NAME } from "@/lib/mock";

type Step = "source" | "sbc" | "exchange" | "lookup" | "confirm";
type Source = "exchange" | "employer" | "medicare" | "medicaid";

const SOURCES: { id: Source; name: string; sub: string }[] = [
  { id: "exchange", name: "HealthCare.gov or my state exchange", sub: "A marketplace plan you bought yourself" },
  { id: "employer", name: "My employer", sub: "Including coverage through a spouse's or parent's job" },
  { id: "medicare", name: "Medicare", sub: "Including Medicare Advantage plans" },
  { id: "medicaid", name: "Medicaid", sub: "Including CHIP and state managed-care plans" },
];

// Marketplace plan IDs: 5-digit HIOS issuer id, 2-letter state, 7 digits.
const PLAN_ID_PATTERN = /^\d{5}[A-Z]{2}\d{7}$/;

// Purely cosmetic — there's no real plan lookup behind this.
const LOOKUP_DELAY_MS = 1200;

export interface InsuranceConnectDialogProps {
  open: boolean;
  onDismiss: () => void;
  onConfirm: (vendor: string) => void;
  alreadyConnected?: (vendor: string) => boolean;
}

export function InsuranceConnectDialog({ open, onDismiss, onConfirm, alreadyConnected }: InsuranceConnectDialogProps) {
  const [step, setStep] = useState<Step>("source");
  const [file, setFile] = useState<File | null>(null);
  const [planId, setPlanId] = useState("");
  const [planYear, setPlanYear] = useState(() => String(new Date().getFullYear()));
  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (lookupRef.current) clearTimeout(lookupRef.current);
    };
  }, []);

  function reset() {
    if (lookupRef.current) clearTimeout(lookupRef.current);
    lookupRef.current = null;
    setStep("source");
    setFile(null);
    setPlanId("");
    setPlanYear(String(new Date().getFullYear()));
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  function handleConfirm() {
    reset();
    onConfirm(DEMO_PAYER_PLAN_NAME);
  }

  function startLookup() {
    setStep("lookup");
    lookupRef.current = setTimeout(() => {
      lookupRef.current = null;
      setStep("confirm");
    }, LOOKUP_DELAY_MS);
  }

  const planIdValid = PLAN_ID_PATTERN.test(planId);
  const exchangeValid = planIdValid && planYear.trim() !== "";
  const isAlreadyConnected = alreadyConnected?.(DEMO_PAYER_PLAN_NAME) ?? false;

  let actions: ReactNode = null;
  if (step === "sbc") {
    actions = (
      <>
        <Button variant="ghost" onClick={() => setStep("source")}>
          Back
        </Button>
        <Button variant="primary" disabled={!file} onClick={startLookup}>
          Submit
        </Button>
      </>
    );
  } else if (step === "exchange") {
    actions = (
      <>
        <Button variant="ghost" onClick={() => setStep("source")}>
          Back
        </Button>
        <Button variant="primary" disabled={!exchangeValid} onClick={startLookup}>
          Continue
        </Button>
      </>
    );
  } else if (step === "confirm") {
    actions = isAlreadyConnected ? (
      <Button variant="primary" onClick={handleDismiss}>
        Close
      </Button>
    ) : (
      <>
        <Button variant="ghost" onClick={reset}>
          Not my plan
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirm
        </Button>
      </>
    );
  }

  return (
    <Dialog open={open} title="Connect your insurance" onDismiss={handleDismiss} actions={actions}>
      {step === "source" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>Where do you get your health insurance?</p>
          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--color-divider)" }}>
            {SOURCES.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setStep(source.id === "exchange" ? "exchange" : "sbc")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "12px 4px",
                  border: "none",
                  borderBottom: "1px solid var(--color-divider)",
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  color: "var(--color-text)",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{source.name}</span>
                <span style={{ fontSize: 12, opacity: 0.55 }}>{source.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "sbc" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Upload your Statement of Benefits. You can usually find it on your plan&apos;s member site or in your
            enrollment paperwork.
          </p>
          <Field label="Statement of Benefits" htmlFor="sbcFile">
            <input
              id="sbcFile"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          {file && <div style={{ fontSize: 12, opacity: 0.6 }}>Selected: {file.name}</div>}
        </div>
      )}

      {step === "exchange" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Enter the plan ID from your marketplace enrollment. It&apos;s 14 characters, like 12345ST1234567.
          </p>
          <Field label="Plan ID" htmlFor="planId">
            <TextInput
              id="planId"
              value={planId}
              maxLength={14}
              autoComplete="off"
              spellCheck={false}
              placeholder="12345ST1234567"
              onChange={(e) => setPlanId(e.target.value.toUpperCase().replace(/\s/g, ""))}
            />
          </Field>
          {planId.length === 14 && !planIdValid && (
            <div style={{ fontSize: 12, color: "var(--color-accent)" }}>
              That doesn&apos;t look like a plan ID. It should be 5 digits, 2 letters, then 7 digits.
            </div>
          )}
          <Field label="Plan year" htmlFor="planYear">
            <TextInput
              id="planYear"
              type="number"
              value={planYear}
              onChange={(e) => setPlanYear(e.target.value)}
            />
          </Field>
        </div>
      )}

      {step === "lookup" && (
        <AiSurface>
          <p style={{ margin: 0 }}>Looking up your plan…</p>
        </AiSurface>
      )}

      {step === "confirm" &&
        (isAlreadyConnected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{DEMO_PAYER_PLAN_NAME}</div>
            <div style={{ alignSelf: "flex-start" }}>
              <Tag variant="neutral">Already connected</Tag>
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
              This plan is already connected, so there&apos;s nothing else to do.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p style={{ margin: 0, fontSize: 14 }}>We found your plan. Is this right?</p>
            <div style={{ border: "1px solid var(--color-divider)", padding: 14, fontSize: 16, fontWeight: 600 }}>
              {DEMO_PAYER_PLAN_NAME}
            </div>
          </div>
        ))}
    </Dialog>
  );
}
