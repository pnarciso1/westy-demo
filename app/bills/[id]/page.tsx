"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardKicker, CardTitle, CardBody, Tag, Button, Skeleton, AiSurface } from "@westy/shared/ui";
import type { Anomaly, Bill, CareTeamMember, Charge } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";
import {
  BillDetailStatusTag,
  billFinancials,
  billTitle,
  draftAppealLetter,
  fallbackExplanation,
  formatMoney,
  formatShortDate,
} from "@/lib/bills";

type Flow =
  | { kind: "none" }
  | { kind: "dispute"; stage: "working" | "done" }
  | { kind: "pay"; stage: "working" | "done" }
  | { kind: "appeal"; stage: "working" | "drafted" | "sent" }
  | { kind: "call"; careTeam: CareTeamMember | null; logged: boolean };

const SEVERITY_LABEL: Record<Anomaly["severity"], string> = {
  info: "Info",
  review: "Review",
  action_needed: "Action needed",
};

const SUGGESTION_COPY: Record<NonNullable<Anomaly["suggestedAction"]>, string> = {
  dispute_with_payer: "My suggestion: dispute this with your insurer — the amount above your plan's benefit likely isn't something you owe.",
  pay_now: "My suggestion: this looks correct as billed — you can pay it now.",
  draft_appeal_email: "My suggestion: draft an appeal to the insurer. I can put the letter together — you'll review it before anything is sent.",
  call_provider: "My suggestion: call the provider's billing office directly to sort this out.",
};

export default function BillDetail() {
  const params = useParams<{ id: string }>();
  const billId = params.id;

  const [bill, setBill] = useState<Bill | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [memberName, setMemberName] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [flow, setFlow] = useState<Flow>({ kind: "none" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await mockWestyClient.getBill(billId);
      const [c, person, currentUser] = await Promise.all([
        mockWestyClient.getCharges(b.chargeIds),
        mockWestyClient.getPerson(b.personId),
        mockWestyClient.getCurrentUser(),
      ]);
      const [a, coordinator] = await Promise.all([
        b.anomalyId ? mockWestyClient.getAnomaly(b.anomalyId) : Promise.resolve(null),
        mockWestyClient.getPerson(currentUser.personId),
      ]);
      if (cancelled) return;
      setBill(b);
      setCharges(c);
      setAnomaly(a);
      setMemberName(`${person.firstName} ${person.lastName}`);
      setCoordinatorName(`${coordinator.firstName} ${coordinator.lastName}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [billId]);

  async function handleDispute() {
    if (!bill) return;
    setFlow({ kind: "dispute", stage: "working" });
    const updated = await mockWestyClient.disputeBill(bill.id);
    setBill(updated);
    setFlow({ kind: "dispute", stage: "done" });
  }

  async function handlePay() {
    if (!bill) return;
    setFlow({ kind: "pay", stage: "working" });
    const updated = await mockWestyClient.payBill(bill.id);
    setBill(updated);
    setFlow({ kind: "pay", stage: "done" });
  }

  function handleStartAppeal() {
    setFlow({ kind: "appeal", stage: "working" });
    setTimeout(() => setFlow({ kind: "appeal", stage: "drafted" }), 1200);
  }

  function handleSendAppeal() {
    setFlow({ kind: "appeal", stage: "sent" });
  }

  async function handleStartCall() {
    if (!bill) return;
    const team = await mockWestyClient.listCareTeam(bill.personId);
    setFlow({ kind: "call", careTeam: team[0] ?? null, logged: false });
  }

  function handleLogCall() {
    if (flow.kind !== "call") return;
    setFlow({ ...flow, logged: true });
  }

  const rawFinancials = billFinancials(charges);
  // Charges themselves don't change when a bill is paid — only Bill.status
  // does — so once the pay flow completes, reflect that in what's shown
  // rather than leaving a stale "you owe" figure next to a "Paid" message.
  const { billed, insurancePaid, owe } =
    flow.kind === "pay" && flow.stage === "done"
      ? { billed: rawFinancials.billed, insurancePaid: rawFinancials.billed, owe: 0 }
      : rawFinancials;

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Connections", href: "/connections" },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <Link href="/bills" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}>
          ← Bills
        </Link>

        {!bill ? (
          <>
            <Skeleton height={14} width={220} />
            <Skeleton height={26} width="60%" />
            <Skeleton height={200} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>
                  {memberName}
                </div>
                <h1 style={{ fontSize: 26, marginBottom: 4 }}>{billTitle(charges, PROVIDER_DIRECTORY)}</h1>
                <p className="text-muted" style={{ fontSize: 14 }}>
                  Service date {formatShortDate(charges[0]?.serviceDate ?? "")}
                </p>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Status</div>
                <BillDetailStatusTag status={bill.status} />
                {anomaly && (
                  <>
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.5 }}>Severity</div>
                    <div style={{ marginTop: 2 }}>
                      <Tag variant="accent">{SEVERITY_LABEL[anomaly.severity]}</Tag>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="hr" />

            <div>
              <h3 style={{ margin: "0 0 12px" }}>The bill</h3>
              <table className="table" style={{ marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th>Line item</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge) => (
                    <tr key={charge.id}>
                      <td>
                        {PROVIDER_DIRECTORY[charge.providerId] ?? charge.providerId} (CPT {charge.cptCode})
                      </td>
                      <td style={{ textAlign: "right" }}>{formatMoney(charge.billedAmount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Total billed</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{formatMoney(billed)}</td>
                  </tr>
                  <tr>
                    <td>Insurance paid</td>
                    <td style={{ textAlign: "right" }}>{insurancePaid === null ? "—" : formatMoney(insurancePaid)}</td>
                  </tr>
                  <tr>
                    <td>Your responsibility</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{formatMoney(owe)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AiSurface>
              <p style={{ margin: anomaly?.suggestedAction && flow.kind === "none" ? "0 0 10px" : 0 }}>
                {anomaly ? anomaly.explanation : fallbackExplanation(bill, { billed, insurancePaid, owe })}
              </p>
              {anomaly?.suggestedAction && flow.kind === "none" && (
                <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>{SUGGESTION_COPY[anomaly.suggestedAction]}</p>
              )}
            </AiSurface>

            {/* ── Action, driven by the anomaly's single suggestedAction ── */}
            {anomaly?.suggestedAction === "dispute_with_payer" && flow.kind === "none" && (
              <Button variant="primary" block onClick={handleDispute}>
                Dispute with payer
              </Button>
            )}
            {anomaly?.suggestedAction === "pay_now" && flow.kind === "none" && (
              <Button variant="primary" block onClick={handlePay}>
                Pay now
              </Button>
            )}
            {anomaly?.suggestedAction === "draft_appeal_email" && flow.kind === "none" && (
              <Button variant="primary" block onClick={handleStartAppeal}>
                Draft an appeal with Westy
              </Button>
            )}
            {anomaly?.suggestedAction === "call_provider" && flow.kind === "none" && (
              <Button variant="primary" block onClick={handleStartCall}>
                Call {PROVIDER_DIRECTORY[charges[0]?.providerId] ?? "provider"} billing
              </Button>
            )}
            {!anomaly && bill.status === "pending" && flow.kind === "none" && (
              <Button variant="primary" block onClick={handlePay}>
                Pay
              </Button>
            )}

            {/* Always available on a flagged bill — disputing takes time, and
                some people will just want it resolved regardless of what
                Westy suggests. Never the primary action. */}
            {bill.status === "flagged" && flow.kind === "none" && (
              <Button variant="ghost" onClick={handlePay}>
                Pay anyway
              </Button>
            )}

            {flow.kind === "dispute" && flow.stage === "working" && (
              <AiSurface>
                <p style={{ margin: 0 }}>Filing a formal dispute with the payer…</p>
              </AiSurface>
            )}
            {flow.kind === "dispute" && flow.stage === "done" && (
              <AiSurface>
                <p style={{ margin: 0 }}>
                  Dispute filed — reference #WD-{bill.id.split("-").pop()}. I&apos;ll track it and let you know when
                  it&apos;s resolved.
                </p>
              </AiSurface>
            )}

            {flow.kind === "pay" && flow.stage === "working" && <Skeleton height={48} />}
            {flow.kind === "pay" && flow.stage === "done" && (
              <div style={{ background: "var(--color-surface)", padding: 14, fontSize: 13 }}>
                Paid {formatMoney(rawFinancials.owe)} today.
              </div>
            )}

            {flow.kind === "appeal" && flow.stage === "working" && (
              <AiSurface>
                <p style={{ margin: 0 }}>Drafting your appeal letter…</p>
              </AiSurface>
            )}
            {flow.kind === "appeal" && (flow.stage === "drafted" || flow.stage === "sent") && anomaly && (
              <AiSurface>
                <div
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-accent-300)",
                    padding: 12,
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    marginBottom: 10,
                  }}
                >
                  {draftAppealLetter({
                    coordinatorName,
                    patientName: memberName,
                    providerName: PROVIDER_DIRECTORY[charges[0]?.providerId] ?? "the provider",
                    serviceDate: charges[0]?.serviceDate ?? "",
                    billedAmount: billed,
                    owe,
                    anomaly,
                  })}
                </div>
                {flow.stage === "drafted" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="secondary">Edit before sending</Button>
                    <Button variant="primary" onClick={handleSendAppeal}>
                      Send appeal
                    </Button>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 14 }}>Appeal sent. I&apos;ll let you know the moment they respond.</p>
                )}
              </AiSurface>
            )}

            {flow.kind === "call" && (
              <>
                <Card>
                  <CardKicker>{flow.careTeam?.organization ?? "Provider"} billing</CardKicker>
                  <CardTitle>{flow.careTeam?.phone ?? "Phone not on file"}</CardTitle>
                  <CardBody>Reference bill #{bill.id} for {memberName}.</CardBody>
                </Card>
                {flow.logged ? (
                  <div style={{ background: "var(--color-surface)", padding: "12px 14px", fontSize: 13 }}>
                    Call logged.
                  </div>
                ) : (
                  <Button variant="secondary" onClick={handleLogCall}>
                    Log this call
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
