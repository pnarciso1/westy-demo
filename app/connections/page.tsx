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

const CONNECTOR_TYPE_LABELS: Record<Connector["type"], string> = {
  payer: "Payer",
  hsa_fsa_card: "HSA/FSA",
  provider_portal: "Provider",
  phr_ehr: "Provider",
};

const MEMBER_LABELS: Record<NonNullable<Person["relationshipToCoordinator"]>, string> = {
  self: "Me",
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  dependent: "Dependent",
  other: "Other",
};

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
  return CONNECTOR_TYPE_LABELS[type];
}

function statusLabel(status: Connector["status"]) {
  if (status === "pending") return "Connecting";
  return status;
}

function memberLabel(person: Person) {
  return person.relationshipToCoordinator
    ? MEMBER_LABELS[person.relationshipToCoordinator]
    : "Household member";
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

function ConnectionsSummary({ onStartConnection }: { onStartConnection: () => void }) {
  return (
    <section>
      <SectionLabel>Connections</SectionLabel>
      <Card>
        <CardKicker>Data sync</CardKicker>
        <CardTitle>Connected accounts</CardTitle>
        <CardBody>
          Manage payer, provider portal, PHR/EHR, and HSA/FSA connections for the Ramirez household.
        </CardBody>
        <div>
          <Button variant="primary" onClick={onStartConnection}>
            Start a new connection
          </Button>
        </div>
      </Card>
    </section>
  );
}

function ConnectionCard({ row, onManage }: { row: ConnectionRow; onManage: (connectorId: string) => void }) {
  const { connector, owner } = row;

  return (
    <Card
      key={connector.id}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-4)",
        borderLeft:
          connector.status === "error"
            ? "3px solid var(--color-accent)"
            : connector.status === "connected"
              ? "3px solid var(--color-accent-2)"
              : "3px solid var(--color-divider)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
          <Tag variant={statusVariant(connector.status)}>{statusLabel(connector.status)}</Tag>
          {connector.status === "error" && <Tag variant="outline">Manual upload available</Tag>}
        </div>
        <CardTitle>{connector.vendor}</CardTitle>
        <CardMeta>
          {connectorLabel(connector.type)} for {owner.firstName} {owner.lastName}
        </CardMeta>
        {connector.lastSyncedAt && <CardBody>Last synced {new Date(connector.lastSyncedAt).toLocaleDateString()}</CardBody>}
        {connector.syncError && <CardBody>{connector.syncError}</CardBody>}
        {connector.status === "error" && (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Button variant="ghost" onClick={() => onManage(connector.id)}>
              Upload instead
            </Button>
          </div>
        )}
      </div>
      <Button variant="secondary" onClick={() => onManage(connector.id)}>
        Manage
      </Button>
    </Card>
  );
}

function ExistingConnections({
  connections,
  onManage,
}: {
  connections: ConnectionRow[];
  onManage: (connectorId: string) => void;
}) {
  return (
    <section>
      <SectionLabel>Existing connections</SectionLabel>
      {connections.length === 0 ? (
        <Card>
          <CardTitle>No connections yet</CardTitle>
          <CardBody>Start by connecting a payer, provider, or HSA/FSA account for someone in the household.</CardBody>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {connections.map((row) => (
            <ConnectionCard key={row.connector.id} row={row} onManage={onManage} />
          ))}
        </div>
      )}
    </section>
  );
}

function HouseholdConnectionCards({
  members,
  connections,
  onConnect,
}: {
  members: Person[];
  connections: ConnectionRow[];
  onConnect: (personId: string) => void;
}) {
  return (
    <section>
      <SectionLabel>Connect household data</SectionLabel>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {members.map((member) => {
          const hasConnection = connections.some(({ owner }) => owner.id === member.id);
          return (
            <Card key={member.id} style={{ minWidth: 220 }}>
              <CardKicker>{memberLabel(member)}</CardKicker>
              <CardTitle>
                {member.firstName} {member.lastName}
              </CardTitle>
              <CardBody>
                {hasConnection
                  ? "Add another payer, provider, or HSA/FSA account."
                  : "Connect a payer, provider, or HSA/FSA account."}
              </CardBody>
              <div>
                <Button variant={hasConnection ? "secondary" : "primary"} onClick={() => onConnect(member.id)}>
                  Connect
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

interface StartConnectionDialogProps {
  members: Person[];
  connections: ConnectionRow[];
  availableConnectors: ConnectorOption[];
  initialPersonId: string | null;
  startingConnection: boolean;
  onDismiss: () => void;
  onStartConnection: (personId: string, option: ConnectorOption) => void;
}

function StartConnectionDialog({
  members,
  connections,
  availableConnectors,
  initialPersonId,
  startingConnection,
  onDismiss,
  onStartConnection,
}: StartConnectionDialogProps) {
  const initialSelectedPersonId = initialPersonId ?? members[0]?.id ?? null;
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(initialSelectedPersonId);
  const [selectedConnectionGroup, setSelectedConnectionGroup] = useState<ConnectionTypeGroup>("provider");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    connectableOptionsForPerson(availableConnectors, connections, initialSelectedPersonId, "provider")[0]?.id ?? null
  );
  const [optionSearch, setOptionSearch] = useState("");
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

  function handleSelectPerson(personId: string) {
    const nextOption =
      connectableOptionsForPerson(availableConnectors, connections, personId, selectedConnectionGroup)[0] ?? null;

    setSelectedPersonId(personId);
    setSelectedOptionId(nextOption?.id ?? null);
    setOptionSearch("");
  }

  function handleSelectConnectionGroup(group: ConnectionTypeGroup) {
    const nextOption =
      connectableOptionsForPerson(availableConnectors, connections, selectedPersonId, group)[0] ?? null;

    setSelectedConnectionGroup(group);
    setSelectedOptionId(nextOption?.id ?? null);
    setOptionSearch("");
  }

  function handleStartConnection() {
    if (!selectedPersonId || !selectedOption) return;
    onStartConnection(selectedPersonId, selectedOption);
  }

  return (
    <Dialog
      open={true}
      title="Start a new connection"
      onDismiss={startingConnection ? undefined : onDismiss}
      actions={
        <>
          <Button variant="ghost" onClick={onDismiss} disabled={startingConnection}>
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
            onChange={(event) => handleSelectPerson(event.target.value)}
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
            onChange={(value) => handleSelectConnectionGroup(value as ConnectionTypeGroup)}
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
                onClick={() => setSelectedOptionId(option.id)}
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
  );
}

interface ManageConnectionDialogProps {
  managedConnection: ConnectionRow | null;
  managingConnection: boolean;
  onDismiss: () => void;
  onRetry: (row: ConnectionRow) => void;
  onRemove: (row: ConnectionRow) => void;
}

function ManageConnectionDialog({
  managedConnection,
  managingConnection,
  onDismiss,
  onRetry,
  onRemove,
}: ManageConnectionDialogProps) {
  return (
    <Dialog
      open={!!managedConnection}
      title="Manage connection"
      onDismiss={managingConnection ? undefined : onDismiss}
      actions={
        managedConnection && (
          <>
            <Button variant="ghost" onClick={onDismiss} disabled={managingConnection}>
              Close
            </Button>
            {(managedConnection.connector.status === "error" ||
              managedConnection.connector.status === "disconnected") && (
              <Button
                variant="secondary"
                onClick={() => onRetry(managedConnection)}
                disabled={managingConnection}
              >
                Retry
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => onRemove(managedConnection)}
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
              {statusLabel(managedConnection.connector.status)}
            </Tag>
          </div>
          {managedConnection.connector.syncError && <CardBody>{managedConnection.connector.syncError}</CardBody>}
          {managedConnection.connector.status === "error" && (
            <Card>
              <CardKicker>Alternative</CardKicker>
              <CardTitle>Upload documents instead</CardTitle>
              {/* TODO: Wire this into the manual upload flow once that demo screen exists. */}
              <CardBody>
                You can still add bills, EOBs, or insurance summaries manually while this connection is unavailable.
              </CardBody>
              <div>
                <Button variant="secondary" disabled>
                  Upload instead
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </Dialog>
  );
}

export default function ConnectionsPage() {
  const pendingConnectorCounter = useRef(0);
  const removedConnectorIds = useRef(new Set<string>());
  const [members, setMembers] = useState<Person[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<ConnectorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectDialogInitialPersonId, setConnectDialogInitialPersonId] = useState<string | null>(null);
  const [managedConnectorId, setManagedConnectorId] = useState<string | null>(null);
  const [startingConnection, setStartingConnection] = useState(false);
  const [managingConnection, setManagingConnection] = useState(false);

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
    setConnectDialogInitialPersonId(personId ?? null);
    setConnectDialogOpen(true);
  }

  async function handleStartConnection(selectedPersonId: string, selectedOption: ConnectorOption) {
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
        <ConnectionsSummary onStartConnection={() => openConnectDialog()} />

        {loading ? (
          <>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </>
        ) : (
          <>
            <ExistingConnections connections={connections} onManage={setManagedConnectorId} />
            <HouseholdConnectionCards members={members} connections={connections} onConnect={openConnectDialog} />
          </>
        )}
      </main>
      {connectDialogOpen && (
        <StartConnectionDialog
          members={members}
          connections={connections}
          availableConnectors={availableConnectors}
          initialPersonId={connectDialogInitialPersonId}
          startingConnection={startingConnection}
          onDismiss={() => setConnectDialogOpen(false)}
          onStartConnection={handleStartConnection}
        />
      )}
      <ManageConnectionDialog
        managedConnection={managedConnection}
        managingConnection={managingConnection}
        onDismiss={() => setManagedConnectorId(null)}
        onRetry={handleRetryConnection}
        onRemove={handleRemoveConnection}
      />
    </>
  );
}
