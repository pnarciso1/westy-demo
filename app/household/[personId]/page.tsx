"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardKicker, CardTitle, CardBody, CardMeta, Tag, Skeleton, SectionLabel } from "@westy/shared/ui";
import type { CareTeamMember, Episode, Document as WestyDocument, Bill, Person } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";
import { BillsListStatusTag, billFinancials, billTitle, formatMoney } from "@/lib/bills";

const DOC_STATUS_LABEL: Record<WestyDocument["status"], string> = {
  uploaded: "Uploaded",
  processing: "Processing…",
  extracted: "Extracted",
  failed: "Failed",
};

export default function HouseholdMember() {
  const params = useParams<{ personId: string }>();
  const personId = params.personId;

  const [person, setPerson] = useState<Person | null>(null);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [documents, setDocuments] = useState<WestyDocument[]>([]);
  const [bills, setBills] = useState<(Bill & { title: string })[]>([]);
  const [totalBilled, setTotalBilled] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, team, eps, docs, personBills] = await Promise.all([
        mockWestyClient.getPerson(personId),
        mockWestyClient.listCareTeam(personId),
        mockWestyClient.listEpisodes(personId),
        mockWestyClient.listDocuments(personId),
        mockWestyClient.listBills(personId),
      ]);
      const billsWithTitles = await Promise.all(
        personBills.map(async (bill) => {
          const charges = await mockWestyClient.getCharges(bill.chargeIds);
          return { ...bill, title: billTitle(charges, PROVIDER_DIRECTORY), billed: billFinancials(charges).billed };
        })
      );
      if (cancelled) return;
      setPerson(p);
      setCareTeam(team);
      setEpisodes(eps);
      setDocuments(docs);
      setBills(billsWithTitles);
      setTotalBilled(billsWithTitles.reduce((sum, b) => sum + b.billed, 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Care Team", href: "/care-team" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <Link
          href="/household"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
        >
          ← Household
        </Link>

        {!person ? (
          <>
            <Skeleton height={26} width="40%" />
            <Skeleton height={200} />
          </>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: 26, marginBottom: 4 }}>
                {person.firstName} {person.lastName}
              </h1>
              <p className="text-muted" style={{ fontSize: 14 }}>
                {person.relationshipToCoordinator ?? "member"}
              </p>
            </div>

            <Card style={{ maxWidth: 320 }}>
              <CardKicker>Billed this year</CardKicker>
              <CardTitle>{formatMoney(totalBilled)}</CardTitle>
              <CardBody>
                Across {bills.length} bill{bills.length === 1 ? "" : "s"}
              </CardBody>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
              <section>
                <SectionLabel>{person.firstName}&apos;s care team</SectionLabel>
                {careTeam.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    No care team on file yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {careTeam.map((member, i) => (
                      <Card key={i} style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                          <CardMeta>
                            {member.role} · {member.organization}
                          </CardMeta>
                        </div>
                        <CardMeta>{member.phone}</CardMeta>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionLabel>{person.firstName}&apos;s documents</SectionLabel>
                {documents.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    No documents on file yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {documents.map((doc) => (
                      <Card key={doc.id} style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{doc.type.replace(/_/g, " ")}</div>
                          <CardMeta>{DOC_STATUS_LABEL[doc.status]}</CardMeta>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section>
              <SectionLabel>{person.firstName}&apos;s episodes</SectionLabel>
              {episodes.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  No active episodes.
                </p>
              ) : (
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  {episodes.map((episode) => (
                    <Card key={episode.id} style={{ minWidth: 220, flex: "1 1 220px" }}>
                      <CardKicker>Episode</CardKicker>
                      <CardTitle>{episode.title}</CardTitle>
                      <CardMeta>
                        {episode.appointmentIds.length} appointment
                        {episode.appointmentIds.length === 1 ? "" : "s"} · {episode.documentIds.length} document
                        {episode.documentIds.length === 1 ? "" : "s"}
                      </CardMeta>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel>{person.firstName}&apos;s bills</SectionLabel>
              {bills.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  No bills on file.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {bills.map((bill) => (
                    <Link key={bill.id} href={`/bills/${bill.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <CardBody>{bill.title}</CardBody>
                        <div style={{ alignSelf: "flex-start" }}>
                          <BillsListStatusTag status={bill.status} />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
