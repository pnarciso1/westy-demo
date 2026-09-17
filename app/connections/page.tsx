"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, TextInput, Tag, AiSurface, SectionLabel, Skeleton } from "@westy/shared/ui";
import type { Connector, Person, PersonalDataExport } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient } from "@/lib/mock";
import { formatShortDate } from "@/lib/bills";

type ConnectorCategory = Extract<Connector["type"], "payer" | "phr_ehr" | "provider_portal" | "hsa_fsa_card">;
type ConnectorWithOwner = Connector & { owner: Person };
type CatalogOption = { id: string; name: string; sub: string };

const CATEGORIES: ConnectorCategory[] = ["payer", "phr_ehr", "provider_portal", "hsa_fsa_card"];

const CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  payer: "Insurance & payer",
  phr_ehr: "Health records (PHR/EHR)",
  provider_portal: "My Care Team",
  hsa_fsa_card: "HSA / FSA cards",
};

// Presentational catalog only — WestyClient has no vendor directory to serve,
// so this is invented, reasonable-looking data for the picker, not real data.
const CATALOG: Record<ConnectorCategory, { placeholder: string; options: CatalogOption[] }> = {
  payer: {
    placeholder: "Search insurers…",
    options: [
      { id: "uhc", name: "UnitedHealthcare", sub: "Medical, dental, vision" },
      { id: "bcbs", name: "Blue Cross Blue Shield", sub: "Choose your state plan after sign-in" },
      { id: "humana", name: "Humana", sub: "Medical, Medicare" },
      { id: "aetna", name: "Aetna", sub: "Medical, dental" },
      { id: "cigna", name: "Cigna Healthcare", sub: "Medical, dental" },
      { id: "kaiser", name: "Kaiser Permanente", sub: "Integrated plan & records" },
    ],
  },
  phr_ehr: {
    placeholder: "Search patient portals…",
    options: [
      { id: "mychart", name: "MyChart (Epic)", sub: "Used by most large hospital systems" },
      { id: "followmyhealth", name: "FollowMyHealth (Veradigm)", sub: "Patient portal" },
      { id: "healow", name: "healow (eClinicalWorks)", sub: "Patient portal" },
      { id: "athena", name: "athenaPatient (athenahealth)", sub: "Patient portal" },
      { id: "cerner", name: "Oracle Health Patient Portal (Cerner)", sub: "Patient portal" },
      { id: "applehealth", name: "Apple Health Records", sub: "Import from iPhone" },
      { id: "riverside-records", name: "Riverside Health patient records", sub: "MyChart-powered" },
    ],
  },
  provider_portal: {
    placeholder: "Search practices & hospitals…",
    options: [
      { id: "riverside-portal", name: "Riverside Health provider portal", sub: "Riverside Hospital, Riverside Family Medicine" },
      { id: "ortho-portal", name: "Riverside Orthopedics patient portal", sub: "Dr. Marcus Webb" },
      { id: "endo-portal", name: "Riverside Endocrine Associates portal", sub: "Dr. Priya Shah" },
      { id: "zocdoc", name: "Zocdoc", sub: "Find & book new providers" },
    ],
  },
  hsa_fsa_card: {
    placeholder: "Search benefit administrators…",
    options: [
      { id: "westypay", name: "WestyPay (Howlite)", sub: "HSA, FSA · pay bills directly from Westy" },
      { id: "healthequity", name: "HealthEquity", sub: "HSA, FSA, HRA" },
      { id: "optum", name: "Optum Financial", sub: "HSA, FSA" },
      { id: "fidelity", name: "Fidelity HSA", sub: "HSA" },
      { id: "wex", name: "WEX Benefits", sub: "FSA, HSA" },
      { id: "lively", name: "Lively", sub: "HSA, FSA" },
      { id: "payflex", name: "Inspira Financial (PayFlex)", sub: "FSA, HSA" },
    ],
  },
};

function initials(name: string): string {
  return name
    .split(/[\s(]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function Connections() {
  const [members, setMembers] = useState<Person[] | null>(null);
  const [coordinatorPersonId, setCoordinatorPersonId] = useState("");
  const [connectors, setConnectors] = useState<ConnectorWithOwner[]>([]);
  const pollsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const [pickerCategory, setPickerCategory] = useState<ConnectorCategory | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const [exportRecord, setExportRecord] = useState<PersonalDataExport | null>(null);
  const exportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadConnectors() {
    const user = await mockWestyClient.getCurrentUser();
    const me = await mockWestyClient.getPerson(user.personId);
    const householdMembers = await mockWestyClient.listHouseholdMembers(me.householdId);
    setMembers(householdMembers);
    setCoordinatorPersonId(user.personId);
    const perMember = await Promise.all(
      householdMembers.map(async (person) => {
        const list = await mockWestyClient.listConnectors(person.id);
        return list.map((c) => ({ ...c, owner: person }));
      })
    );
    setConnectors(perMember.flat());
  }

  useEffect(() => {
    loadConnectors();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollsRef.current).forEach(clearInterval);
      if (exportPollRef.current) clearInterval(exportPollRef.current);
    };
  }, []);

  function pollConnector(connectorId: string) {
    const interval = setInterval(async () => {
      const updated = await mockWestyClient.getConnector(connectorId);
      setConnectors((prev) => prev.map((c) => (c.id === connectorId ? { ...updated, owner: c.owner } : c)));
      if (updated.status !== "pending") {
        clearInterval(interval);
        delete pollsRef.current[connectorId];
      }
    }, 500);
    pollsRef.current[connectorId] = interval;
  }

  async function handlePick(category: ConnectorCategory, option: CatalogOption) {
    const owner = members?.find((m) => m.id === coordinatorPersonId);
    if (!owner) return;
    const connector = await mockWestyClient.initiateConnector({
      ownerPersonId: coordinatorPersonId,
      type: category,
      vendor: option.name,
    });
    setConnectors((prev) => [...prev, { ...connector, owner }]);
    setPickerCategory(null);
    setPickerQuery("");
    pollConnector(connector.id);
  }

  async function handleReconnect(connectorId: string) {
    const updated = await mockWestyClient.retryConnector(connectorId);
    setConnectors((prev) => prev.map((c) => (c.id === connectorId ? { ...updated, owner: c.owner } : c)));
    pollConnector(connectorId);
  }

  async function handleDisconnect(connectorId: string) {
    const updated = await mockWestyClient.disconnectConnector(connectorId);
    setConnectors((prev) => prev.map((c) => (c.id === connectorId ? { ...updated, owner: c.owner } : c)));
  }

  async function handleRemove(connectorId: string) {
    await mockWestyClient.removeConnector(connectorId);
    setConnectors((prev) => prev.filter((c) => c.id !== connectorId));
  }

  function pollExport(exportId: string) {
    const interval = setInterval(async () => {
      const updated = await mockWestyClient.getDataExport(exportId);
      setExportRecord(updated);
      if (updated.status !== "pending") clearInterval(interval);
    }, 500);
    exportPollRef.current = interval;
  }

  async function handleRequestExport() {
    if (!coordinatorPersonId) return;
    const record = await mockWestyClient.requestDataExport(coordinatorPersonId);
    setExportRecord(record);
    pollExport(record.id);
  }

  function handleDownload() {
    if (!exportRecord) return;
    const blob = new Blob([JSON.stringify(exportRecord.contents, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `westy-export-${exportRecord.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const pickerCatalog = pickerCategory ? CATALOG[pickerCategory] : null;
  const filteredOptions =
    pickerCatalog?.options.filter((o) => {
      const q = pickerQuery.trim().toLowerCase();
      return !q || o.name.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q);
    }) ?? [];

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Connections", href: "/connections", active: true },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Connections</h1>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Everything Westy pulls from automatically. Add, reconnect, or disconnect anytime — nothing here is
            required.
          </p>
        </div>

        {!members ? (
          <>
            <Skeleton height={80} />
            <Skeleton height={80} />
          </>
        ) : (
          <>
            {CATEGORIES.map((category) => {
              const items = connectors.filter((c) => c.type === category);
              return (
                <section key={category}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <SectionLabel>{CATEGORY_LABEL[category]}</SectionLabel>
                    <Button variant="ghost" onClick={() => setPickerCategory(category)}>
                      + Add connection
                    </Button>
                  </div>

                  {items.length === 0 && (
                    <div style={{ border: "1px dashed var(--color-divider)", padding: 14, fontSize: 13, opacity: 0.6 }}>
                      Nothing connected in this category yet.
                    </div>
                  )}

                  {items.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        border: "1px solid var(--color-divider)",
                        padding: 14,
                        marginBottom: 8,
                        opacity: c.status === "disconnected" ? 0.55 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            background: "var(--color-neutral-200)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            flex: "none",
                          }}
                        >
                          {initials(c.vendor)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.vendor}</div>
                          <div style={{ fontSize: 12, opacity: 0.55 }}>
                            {c.owner.firstName} {c.owner.lastName}
                            {c.status === "connected" && c.lastSyncedAt
                              ? ` · Synced ${formatShortDate(c.lastSyncedAt)}`
                              : ""}
                          </div>
                        </div>
                        {c.status === "pending" && <Tag variant="outline">Connecting…</Tag>}
                        {c.status === "connected" && (
                          <>
                            <Tag variant="neutral">Connected</Tag>
                            <Button variant="ghost" onClick={() => handleDisconnect(c.id)}>
                              Disconnect
                            </Button>
                          </>
                        )}
                        {c.status === "error" && (
                          <>
                            <Tag variant="accent">Needs attention</Tag>
                            <Button variant="secondary" onClick={() => handleReconnect(c.id)}>
                              Reconnect
                            </Button>
                          </>
                        )}
                        {c.status === "disconnected" && (
                          <>
                            <Tag variant="neutral">Disconnected</Tag>
                            <Button variant="secondary" onClick={() => handleReconnect(c.id)}>
                              Reconnect
                            </Button>
                            <Button variant="ghost" onClick={() => handleRemove(c.id)}>
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                      {c.status === "error" && c.syncError && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid var(--color-divider)",
                            fontSize: 13,
                          }}
                        >
                          {c.syncError}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}

            <p style={{ fontSize: 11, opacity: 0.5 }}>
              Connected = active and syncing. Disconnected (dimmed) = you turned it off; reconnect anytime. Needs
              attention (red) = Westy couldn&apos;t reach it and will keep retrying.
            </p>

            <div>
              <div className="hr" />
              <h3 style={{ margin: "24px 0 8px" }}>Your data</h3>
              <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
                Download everything Westy has for you — bills, documents, and care team info — as a single file.
              </p>

              {!exportRecord && (
                <Button variant="secondary" onClick={handleRequestExport}>
                  Request an export
                </Button>
              )}
              {exportRecord?.status === "pending" && (
                <AiSurface>
                  <p style={{ margin: 0 }}>Preparing your export… this usually takes a minute.</p>
                </AiSurface>
              )}
              {exportRecord?.status === "ready" && (
                <div
                  style={{
                    border: "1px solid var(--color-divider)",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Your export is ready</div>
                    <div style={{ fontSize: 12, opacity: 0.55 }}>Generated just now</div>
                  </div>
                  <Button variant="primary" onClick={handleDownload}>
                    Download
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Dialog
        open={pickerCategory !== null}
        title="Add a connection"
        onDismiss={() => {
          setPickerCategory(null);
          setPickerQuery("");
        }}
      >
        {pickerCategory && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Field label="Search" htmlFor="pickerSearch">
              <TextInput
                id="pickerSearch"
                placeholder={CATALOG[pickerCategory].placeholder}
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflow: "auto", borderTop: "1px solid var(--color-divider)" }}>
              {filteredOptions.map((option) => {
                const already = connectors.some((c) => c.type === pickerCategory && c.vendor === option.name);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={already}
                    onClick={() => handlePick(pickerCategory, option)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 4px",
                      border: "none",
                      borderBottom: "1px solid var(--color-divider)",
                      background: "none",
                      cursor: already ? "default" : "pointer",
                      textAlign: "left",
                      font: "inherit",
                      color: "var(--color-text)",
                      width: "100%",
                      opacity: already ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: "var(--color-neutral-200)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flex: "none",
                      }}
                    >
                      {initials(option.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{option.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.55 }}>{option.sub}</div>
                    </div>
                    {already && <Tag variant="neutral">Added</Tag>}
                  </button>
                );
              })}
              {filteredOptions.length === 0 && (
                <div style={{ padding: "16px 4px", fontSize: 13, opacity: 0.6 }}>No match.</div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
