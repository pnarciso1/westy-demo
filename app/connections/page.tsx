"use client";

import { useEffect, useRef, useState } from "react";
import type { Person } from "@westy/shared";
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
  TextInput,
} from "@westy/shared/ui";
// TODO: Replace with `import type { Connector, ConnectorOption } from "@westy/shared"` once both interfaces are added there.
import type { Connector, ConnectorOption } from "@/lib/demo/connectorTypes";
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

function usedConnectorOptionIds(connections: ConnectionRow[], personId: string | null) {
  if (!personId) return new Set<string>();

  return new Set(
    connections
      .filter(({ connector }) => connector.ownerPersonId === personId)
      .map(({ connector }) => connector.connectorOptionId)
  );
}

function connectableOptionsForPerson(
  options: ConnectorOption[],
  connections: ConnectionRow[],
  personId: string | null,
  group: ConnectionTypeGroup
) {
  const unavailableOptionIds = usedConnectorOptionIds(connections, personId);
  return options.filter((option) => optionMatchesGroup(option, group) && !unavailableOptionIds.has(option.id));
}

export default function ConnectionsPage() {
  const pendingConnectorCounter = useRef(0);
  const removedConnectorIds = useRef(new Set<string>());
  const [members, setMembers] = useState<Person[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<ConnectorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [managedConnectorId, setManagedConnectorId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedConnectionGroup, setSelectedConnectionGroup] = useState<ConnectionTypeGroup>("provider");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [optionSearch, setOptionSearch] = useState("");
  const [startingConnection, setStartingConnection] = useState(false);
  const [managingConnection, setManagingConnection] = useState(false);

  const connectableOptions = connectableOptionsForPerson(
    availableConnectors,
    connections,
    selectedPersonId,
    selectedConnectionGroup
  );
  const selectedOption = connectableOptions.find((option) => option.id === selectedOptionId) ?? null;
  const normalizedOptionSearch = optionSearch.trim().toLowerCase();
  const visibleOptions = normalizedOptionSearch
    ? connectableOptions.filter((option) => option.vendor.toLowerCase().includes(normalizedOptionSearch))
    : connectableOptions;
  const managedConnection = connections.find(({ connector }) => connector.id === managedConnectorId) ?? null;

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
    const nextConnectableOptions = connectableOptionsForPerson(
      availableConnectors,
      connections,
      nextPersonId,
      selectedConnectionGroup
    );
    const nextOption = nextConnectableOptions.find((option) => option.id === selectedOptionId) ?? nextConnectableOptions[0] ?? null;

    setSelectedPersonId(nextPersonId);
    if (nextOption) {
      setSelectedOptionId(nextOption.id);
    }
    setOptionSearch("");
    setConnectDialogOpen(true);
  }

  function selectOption(option: ConnectorOption) {
    setSelectedOptionId(option.id);
  }

  function selectConnectionGroup(group: ConnectionTypeGroup) {
    const nextOption =
      connectableOptionsForPerson(availableConnectors, connections, selectedPersonId, group)[0] ?? null;

    setSelectedConnectionGroup(group);
    setSelectedOptionId(nextOption?.id ?? null);
    setOptionSearch("");
  }

  function selectPerson(personId: string) {
    const nextOption =
      connectableOptionsForPerson(availableConnectors, connections, personId, selectedConnectionGroup)[0] ?? null;

    setSelectedPersonId(personId);
    setSelectedOptionId(nextOption?.id ?? null);
    setOptionSearch("");
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
      connectorOptionId: selectedOption.id,
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

    if (removedConnectorIds.current.has(pendingConnector.id)) {
      await mockWestyClient.removeConnector(connector.id);
      setStartingConnection(false);
      return;
    }

    setConnections((current) =>
      current.map((row) => (row.connector.id === pendingConnector.id ? { connector, owner } : row))
    );
    setStartingConnection(false);
  }

  async function handleRetryConnection(row: ConnectionRow) {
    if (row.connector.status !== "error" && row.connector.status !== "disconnected") return;

    setManagingConnection(true);
    setManagedConnectorId(null);
    const pendingConnector: Connector = {
      ...row.connector,
      status: "pending",
      syncError: undefined,
    };
    setConnections((current) =>
      current.map((currentRow) =>
        currentRow.connector.id === row.connector.id ? { connector: pendingConnector, owner: row.owner } : currentRow
      )
    );

    const connector = await mockWestyClient.retryConnector(row.connector.id);
    if (removedConnectorIds.current.has(row.connector.id)) {
      await mockWestyClient.removeConnector(connector.id);
      setManagingConnection(false);
      return;
    }

    setConnections((current) =>
      current.map((currentRow) =>
        currentRow.connector.id === connector.id ? { connector, owner: row.owner } : currentRow
      )
    );
    setManagingConnection(false);
  }

  async function handleRemoveConnection(row: ConnectionRow) {
    setManagingConnection(true);
    setManagedConnectorId(null);
    removedConnectorIds.current.add(row.connector.id);
    setConnections((current) => current.filter(({ connector }) => connector.id !== row.connector.id));

    if (!row.connector.id.startsWith("pending-")) {
      await mockWestyClient.removeConnector(row.connector.id);
    }

    setManagingConnection(false);
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
                    <Button variant="secondary" onClick={() => setManagedConnectorId(connector.id)}>
                      Manage
                    </Button>
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
              onChange={(event) => selectPerson(event.target.value)}
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

          <Field label="Find a connection" htmlFor="connection-search">
            <TextInput
              id="connection-search"
              placeholder="Search providers, payers, or accounts"
              value={optionSearch}
              onChange={(event) => setOptionSearch(event.target.value)}
            />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 260, overflowY: "auto" }}>
            {connectableOptions.length === 0 ? (
              <CardBody>No new demo connectors are available for this person and type.</CardBody>
            ) : visibleOptions.length === 0 ? (
              <CardBody>No matching connections.</CardBody>
            ) : visibleOptions.map((option) => {
              const selected = option.id === selectedOption?.id;
              return (
                <Button
                  key={option.id}
                  variant={selected ? "primary" : "secondary"}
                  block
                  aria-pressed={selected}
                  onClick={() => selectOption(option)}
                  type="button"
                >
                  <span style={{ display: "block" }}>{option.vendor}</span>
                  <span style={{ display: "block", fontWeight: 400 }}>{connectorLabel(option.connectorType)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </Dialog>
      <Dialog
        open={!!managedConnection}
        title="Manage connection"
        onDismiss={managingConnection ? undefined : () => setManagedConnectorId(null)}
        actions={
          managedConnection && (
            <>
              <Button variant="ghost" onClick={() => setManagedConnectorId(null)} disabled={managingConnection}>
                Close
              </Button>
              {(managedConnection.connector.status === "error" ||
                managedConnection.connector.status === "disconnected") && (
                <Button
                  variant="secondary"
                  onClick={() => handleRetryConnection(managedConnection)}
                  disabled={managingConnection}
                >
                  Retry
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => handleRemoveConnection(managedConnection)}
                disabled={managingConnection}
              >
                {managedConnection.connector.status === "pending" ? "Cancel connection" : "Remove connection"}
              </Button>
            </>
          )
        }
      >
        {managedConnection && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div>
              <CardTitle>{managedConnection.connector.vendor}</CardTitle>
              <CardMeta>
                {connectorLabel(managedConnection.connector.type)} for {managedConnection.owner.firstName}{" "}
                {managedConnection.owner.lastName}
              </CardMeta>
            </div>
            <div>
              <Tag variant={statusVariant(managedConnection.connector.status)}>
                {managedConnection.connector.status}
              </Tag>
            </div>
            {managedConnection.connector.syncError && <CardBody>{managedConnection.connector.syncError}</CardBody>}
          </div>
        )}
      </Dialog>
    </>
  );
}
