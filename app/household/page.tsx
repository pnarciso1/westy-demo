"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle, CardBody, Tag, Skeleton, SectionLabel } from "@westy/shared/ui";
import type { Person } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient } from "@/lib/mock";

const FINANCIAL_ACCESS_LABEL: Record<Person["financialAccess"], string> = {
  self: "Manages own finances",
  coordinator: "Coordinator manages finances",
  shared: "Shared access",
};

function personSubtitle(person: Person): string {
  const role = person.relationshipToCoordinator ?? "member";
  if (role === "child") {
    const age = Math.floor(
      (Date.now() - new Date(person.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    return `Child · age ${age}`;
  }
  const birthYear = new Date(person.dateOfBirth).getUTCFullYear();
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} · b. ${birthYear}`;
}

export default function Household() {
  const router = useRouter();
  const [members, setMembers] = useState<Person[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const me = await mockWestyClient.getPerson(user.personId);
      const household = await mockWestyClient.listHouseholdMembers(me.householdId);
      if (!cancelled) setMembers(household);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Care Team", href: "/care-team" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household", active: true },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>My Household</h1>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Every family member&apos;s care, documents, and history — on their own.
          </p>
        </div>

        {!members ? (
          <>
            <Skeleton height={100} />
            <Skeleton height={100} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {members.map((person) => (
                <Card
                  key={person.id}
                  style={{ minWidth: 200, flex: "1 1 200px", cursor: "pointer" }}
                  onClick={() => router.push(`/household/${person.id}`)}
                >
                  <CardTitle>
                    {person.firstName} {person.lastName}
                  </CardTitle>
                  <CardBody>{personSubtitle(person)}</CardBody>
                </Card>
              ))}
            </div>

            <div>
              <div className="hr" />
              <SectionLabel>Household access</SectionLabel>
              <p style={{ fontSize: 13, opacity: 0.6, marginBottom: "var(--space-3)", maxWidth: "60ch" }}>
                Who can see what. Financial data (bills, spend, HSA/FSA) can be scoped per person — care team and
                appointments stay visible either way.
              </p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {members.map((person) => (
                  <div
                    key={person.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "12px 0",
                      borderBottom: "1px solid var(--color-divider)",
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
                      {person.firstName} {person.lastName}
                    </div>
                    <Tag variant="neutral">{FINANCIAL_ACCESS_LABEL[person.financialAccess]}</Tag>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
