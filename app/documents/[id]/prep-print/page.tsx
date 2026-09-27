"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton, AiSurface, ProvenanceSurface } from "@westy/shared/ui";
import type { AppointmentPrepBoost, Document as WestyDocument, Person } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { mockWestyClient } from "@/lib/mock";

/** Shape of Document.extracted for an appointment_prep Document — see MockWestyClient.generateAppointmentPrepDocument. */
type PrepExtracted = {
  provider: string;
  scheduledFor: string;
  reason?: string;
  address?: string;
  phone?: string;
  whatToBring: string[];
  userNotes?: string;
};

function formatVisitDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AppointmentPrepPrintSheet() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;

  const [doc, setDoc] = useState<WestyDocument | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [boost, setBoost] = useState<AppointmentPrepBoost | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fetchedDoc = await mockWestyClient.getDocument(documentId);
        if (fetchedDoc.type !== "appointment_prep") {
          setNotFound(true);
          return;
        }
        const personRecord = await mockWestyClient.getPerson(fetchedDoc.personId);
        // The Boost that generated this Document may belong to a different
        // person than the Document itself (e.g. a coordinator's Boost for a
        // child's appointment) — search every household member's boosts
        // rather than assuming Document.personId === Boost.personId.
        const householdMembers = await mockWestyClient.listHouseholdMembers(personRecord.householdId);
        const boostsByMember = await Promise.all(householdMembers.map((m) => mockWestyClient.listBoosts(m.id)));
        const matchingBoost = boostsByMember
          .flat()
          .find((b): b is AppointmentPrepBoost => b.kind === "appointment_prep" && b.generatedDocumentId === fetchedDoc.id);
        setDoc(fetchedDoc);
        setPerson(personRecord);
        setBoost(matchingBoost ?? null);
      } catch {
        setNotFound(true);
      }
    })();
  }, [documentId]);

  const extracted = doc?.extracted as PrepExtracted | undefined;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          a[href="/ask-westy"] { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print">
        <AppNav
          brand="Westy"
          links={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Bills", href: "/bills" },
            { label: "Household", href: "/household" },
            { label: "Appointments", href: "/appointments" },
            { label: "Connections", href: "/connections" },
            { label: "Ask Westy", href: "/ask-westy" },
          ]}
          trailing={<UserAvatar />}
        />
      </div>

      <main style={{ padding: "var(--space-6)", maxWidth: 640, margin: "0 auto" }}>
        {notFound && <p style={{ fontSize: 14 }}>This prep sheet couldn&apos;t be found.</p>}

        {!notFound && (!doc || !person || !extracted) ? (
          <>
            <Skeleton height={32} width="60%" style={{ marginBottom: 16 }} />
            <Skeleton height={120} style={{ marginBottom: 16 }} />
            <Skeleton height={80} />
          </>
        ) : (
          doc &&
          person &&
          extracted && (
            <>
              <div
                className="no-print"
                style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}
              >
                <button className="btn btn-primary" onClick={() => window.print()}>
                  Print
                </button>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>
                  Appointment Prep
                </div>
                <h1 style={{ fontSize: 26, margin: "4px 0 4px" }}>
                  {person.firstName} {person.lastName}&apos;s visit with {extracted.provider}
                </h1>
                <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
                  {formatVisitDateTime(extracted.scheduledFor)}
                  {extracted.reason ? ` · ${extracted.reason}` : ""}
                </p>
              </div>

              <div className="hr" style={{ margin: "var(--space-4) 0" }} />

              <section style={{ marginBottom: "var(--space-5)" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Visit details</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                  <div>
                    <strong>Provider:</strong> {extracted.provider}
                  </div>
                  <div>
                    <strong>When:</strong> {formatVisitDateTime(extracted.scheduledFor)}
                  </div>
                  {extracted.address && (
                    <div>
                      <strong>Address:</strong> {extracted.address}
                    </div>
                  )}
                  {extracted.phone && (
                    <div>
                      <strong>Phone:</strong> {extracted.phone}
                    </div>
                  )}
                  <div>
                    <strong>What to bring:</strong> {extracted.whatToBring.join(", ")}
                  </div>
                </div>
              </section>

              {boost?.prepNotes && (
                <section style={{ marginBottom: "var(--space-5)" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Westy&apos;s suggested talking points</h3>
                  <AiSurface>
                    <p style={{ margin: 0 }}>{boost.prepNotes}</p>
                  </AiSurface>
                </section>
              )}

              <section style={{ marginBottom: "var(--space-5)" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Your notes</h3>
                <ProvenanceSurface label="You entered this">
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {extracted.userNotes && extracted.userNotes.trim() !== "" ? extracted.userNotes : "No notes added."}
                  </p>
                </ProvenanceSurface>
              </section>
            </>
          )
        )}
      </main>
    </>
  );
}
