"use client";

import { useEffect, useRef, useState } from "react";
import type { Connector, Person } from "@westy/shared";
import {
  Button,
  Card,
  CardBody,
  CardKicker,
  CardMeta,
  CardTitle,
  Dialog,
  Field,
  SectionLabel,
  SegmentedControl,
  Skeleton,
  Tag,
} from "@westy/shared/ui";
// TODO: Replace with `import type { ConnectorOption } from "@westy/shared"` once the interface is added there.
import type { ConnectorOption } from "@/lib/demo/connectorTypes";
import { mockWestyClient } from "@/lib/mock";
import { AppNav } from "../components/AppNav";

type ConnectionTypeGroup = "provider" | "payer" | "hsa_fsa_card";

const CONNECTION_TYPE_GROUPS: { value: ConnectionTypeGroup; label: string }[] = [
  { value: "provider", label: "Provider" },
  { value: "payer", label: "Payer" },
  { value: "hsa_fsa_card", label: "HSA/FSA" },
];

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

function optionMatchesGroup(option: ConnectorOption, group: ConnectionTypeGroup) {
  if (group === "provider") {
    return option.connectorType === "provider_portal" || option.connectorType === "phr_ehr";
  }

  return option.connectorType === group;
}

function firstOptionForGroup(options: ConnectorOption[], group: ConnectionTypeGroup) {
  return options.find((option) => optionMatchesGroup(option, group));
}

export default function ConnectionsPage() {
  const pendingConnectorCounter = useRef(0);
  const [members, setMembers] = useState<Person[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<ConnectorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedConnectionGroup, setSelectedConnectionGroup] = useState<ConnectionTypeGroup>("provider");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [startingConnection, setStartingConnection] = useState(false);

  const filteredOptions = availableConnectors.filter((option) =>
    optionMatchesGroup(option, selectedConnectionGroup)
  );
  const selectedOption = filteredOptions.find((option) => option.id === selectedOptionId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      const user = await mockWestyClient.getCurrentUser();
      const household = await mockWestyClient.getHousehold("hh-ramirez");
      void user;
      const householdMembers = await mockWestyClient.listHouseholdMembers(household.id);
      const connectorOptions = await mockWestyClient.listAvailableConnectors();
      const memberConnections = await Promise.all(
        householdMembers.map(async (member) => {
          const connectors = await mockWestyClient.listConnectors(member.id);
          return connectors.map((connector) => ({ connector, owner: member }));
        })
      );

      if (!cancelled) {
        setMembers(householdMembers);
        setAvailableConnectors(connectorOptions);
        setConnections(memberConnections.flat());
        setLoading(false);
      }
    }

    loadConnections();

    return () => {
      cancelled = true;
    };
  }, []);

  function openConnectDialog(personId?: string) {
    const nextPersonId = personId ?? selectedPersonId ?? members[0]?.id ?? null;
    const nextOption = selectedOption ?? firstOptionForGroup(availableConnectors, selectedConnectionGroup) ?? null;

    setSelectedPersonId(nextPersonId);
    if (nextOption) {
      setSelectedOptionId(nextOption.id);
    }
    setConnectDialogOpen(true);
  }

  function selectOption(option: ConnectorOption) {
    setSelectedOptionId(option.id);
  }

  function selectConnectionGroup(group: ConnectionTypeGroup) {
    setSelectedConnectionGroup(group);
    setSelectedOptionId(firstOptionForGroup(availableConnectors, group)?.id ?? null);
  }

  async function handleStartConnection() {
    if (!selectedOption || !selectedPersonId) return;
    setStartingConnection(true);
    setConnectDialogOpen(false);

    const owner = members.find((member) => member.id === selectedPersonId) ?? (await mockWestyClient.getPerson(selectedPersonId));
    pendingConnectorCounter.current += 1;
    const pendingConnectorId = `pending-${selectedPersonId}-${selectedOption.id}-${pendingConnectorCounter.current}`;
    const pendingConnector: Connector = {
      id: pendingConnectorId,
      ownerPersonId: selectedPersonId,
      type: selectedOption.connectorType,
      vendor: selectedOption.vendor,
      status: "pending",
      credentialRef: "pending",
    };

    setConnections((current) => [{ connector: pendingConnector, owner }, ...current]);

    const connector = await mockWestyClient.initiateConnector({
      ownerPersonId: selectedPersonId,
      type: selectedOption.connectorType,
      vendor: selectedOption.vendor,
    });

    setConnections((current) =>
      current.map((row) => (row.connector.id === pendingConnector.id ? { connector, owner } : row))
    );
    setStartingConnection(false);
  }

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
              <Button variant="primary" onClick={() => openConnectDialog()}>
                Start a new connection
              </Button>
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
                      {connector.syncError && <CardBody>{connector.syncError}</CardBody>}
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
                        <Button variant={hasConnection ? "secondary" : "primary"} onClick={() => openConnectDialog(member.id)}>
                          Connect
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
      <Dialog
        open={connectDialogOpen}
        title="Start a new connection"
        onDismiss={startingConnection ? undefined : () => setConnectDialogOpen(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConnectDialogOpen(false)} disabled={startingConnection}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStartConnection}
              disabled={startingConnection || !selectedOption || !selectedPersonId}
            >
              {startingConnection ? "Connecting..." : "Connect"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Field label="Who is this for?" htmlFor="connection-owner">
            <select
              id="connection-owner"
              className="input"
              value={selectedPersonId ?? ""}
              onChange={(event) => setSelectedPersonId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Connection type" htmlFor="connection-type">
            <SegmentedControl
              name="connection-type"
              options={CONNECTION_TYPE_GROUPS}
              value={selectedConnectionGroup}
              onChange={(value) => selectConnectionGroup(value as ConnectionTypeGroup)}
            />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {filteredOptions.length === 0 ? (
              <CardBody>No demo connectors are available for this type yet.</CardBody>
            ) : filteredOptions.map((option) => {
              const selected = option.id === selectedOption?.id;
              return (
                <Button
                  key={option.id}
                  variant={selected ? "primary" : "secondary"}
                  block
                  onClick={() => selectOption(option)}
                  type="button"
                >
                  <span style={{ display: "block" }}>{option.vendor}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </>
  );
}
