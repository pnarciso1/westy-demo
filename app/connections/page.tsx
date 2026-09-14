"use client";

import { useEffect, useState } from "react";
import type { Connector, Person } from "@westy/shared";
import {
  Button,
  Card,
  CardBody,
  CardKicker,
  CardMeta,
  CardTitle,
  SectionLabel,
  Skeleton,
  Tag,
} from "@westy/shared/ui";
import { mockWestyClient } from "@/lib/mock";
import { AppNav } from "../components/AppNav";

interface ConnectionRow {
  connector: Connector;
  owner: Person;
}

function statusVariant(status: Connector["status"]) {
  if (status === "connected") return "accent-2";
  if (status === "error") return "accent";
  if (status === "disconnected") return "outline";
  return "neutral";
}

function connectorLabel(type: Connector["type"]) {
  return type
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ConnectionsPage() {
  const [members, setMembers] = useState<Person[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      const user = await mockWestyClient.getCurrentUser();
      const household = await mockWestyClient.getHousehold("hh-ramirez");
      void user;
      const householdMembers = await mockWestyClient.listHouseholdMembers(household.id);
      const memberConnections = await Promise.all(
        householdMembers.map(async (member) => {
          const connectors = await mockWestyClient.listConnectors(member.id);
          return connectors.map((connector) => ({ connector, owner: member }));
        })
      );

      if (!cancelled) {
        setMembers(householdMembers);
        setConnections(memberConnections.flat());
        setLoading(false);
      }
    }

    loadConnections();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AppNav active="connections" />
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
        <section>
          <SectionLabel>Connections</SectionLabel>
          <Card>
            <CardKicker>Data sync</CardKicker>
            <CardTitle>Connected accounts</CardTitle>
            <CardBody>
              Manage payer, provider portal, PHR/EHR, and HSA/FSA connections for the Ramirez household.
            </CardBody>
            <div>
              <Button variant="primary">Start a new connection</Button>
            </div>
          </Card>
        </section>

        {loading ? (
          <>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </>
        ) : (
          <>
            <section>
              <SectionLabel>Existing connections</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {connections.map(({ connector, owner }) => (
                  <Card
                    key={connector.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-4)",
                    }}
                  >
                    <div>
                      <div style={{ marginBottom: "var(--space-2)" }}>
                        <Tag variant={statusVariant(connector.status)}>{connector.status}</Tag>
                      </div>
                      <CardTitle>{connector.vendor}</CardTitle>
                      <CardMeta>
                        {connectorLabel(connector.type)} for {owner.firstName} {owner.lastName}
                      </CardMeta>
                      {connector.lastSyncedAt && (
                        <CardBody>Last synced {new Date(connector.lastSyncedAt).toLocaleDateString()}</CardBody>
                      )}
                    </div>
                    <Button variant="secondary">Manage</Button>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Available next connections</SectionLabel>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {members.map((member) => {
                  const hasConnection = connections.some(({ owner }) => owner.id === member.id);
                  return (
                    <Card key={member.id} style={{ minWidth: 220 }}>
                      <CardKicker>{member.relationshipToCoordinator ?? "member"}</CardKicker>
                      <CardTitle>
                        {member.firstName} {member.lastName}
                      </CardTitle>
                      <CardBody>
                        {hasConnection
                          ? "Add another payer or provider portal for this household member."
                          : "No active data connection yet."}
                      </CardBody>
                      <div>
                        <Button variant={hasConnection ? "secondary" : "primary"}>Connect</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
