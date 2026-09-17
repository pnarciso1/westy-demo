"use client";

import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Tag,
  Button,
  Dialog,
  Field,
  TextInput,
  Skeleton,
  SectionLabel,
  AiSurface,
} from "@westy/shared/ui";
import type { Appointment, CareTeamMember, Document as WestyDocument, Episode, Person } from "@westy/shared";
import type { AddCareTeamMemberInput, ProposedSlot } from "@westy/shared/client";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { mockWestyClient, CARE_TEAM_PROVIDER_ID } from "@/lib/mock";
import { billFinancials, formatMoney } from "@/lib/bills";
import { DOC_TYPE_LABEL, DOC_SOURCE_LABEL, DocumentStatusTag } from "@/lib/documents";

const FINANCIAL_ACCESS_LABEL: Record<Person["financialAccess"], string> = {
  self: "Manages own finances",
  coordinator: "Coordinator manages finances",
  shared: "Shared access",
};

const AVATAR_COLORS = ["var(--color-neutral-800)", "var(--color-neutral-700)", "var(--color-accent-700)", "var(--color-accent-600)"];

function personSubtitle(person: Person): string {
  const role = person.relationshipToCoordinator ?? "member";
  if (role === "child") {
    const age = Math.floor((Date.now() - new Date(person.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return `Child · age ${age}`;
  }
  const birthYear = new Date(person.dateOfBirth).getUTCFullYear();
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} · b. ${birthYear}`;
}

function initials(person: Person): string {
  return `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();
}

type RequestState =
  | { status: "idle" }
  | { status: "submitted" | "searching" }
  | { status: "proposed"; requestId: string; slots: ProposedSlot[] }
  | { status: "confirming" }
  | { status: "booked"; appointment: Appointment };

type FormValues = {
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  website: string;
  address: string;
};

type FormTarget = { mode: "add"; personId: string } | { mode: "edit"; personId: string; memberId: string };

const EMPTY_FORM: FormValues = { name: "", role: "", organization: "", phone: "", email: "", website: "", address: "" };

function formToInput(personId: string, values: FormValues): AddCareTeamMemberInput {
  return {
    personId,
    name: values.name.trim(),
    role: values.role.trim(),
    organization: values.organization.trim() || undefined,
    phone: values.phone.trim() || undefined,
    email: values.email.trim() || undefined,
    website: values.website.trim() || undefined,
    address: values.address.trim() || undefined,
  };
}

function formatSlot(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function Household() {
  const [members, setMembers] = useState<Person[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [spendByMember, setSpendByMember] = useState<Record<string, number>>({});
  const [householdTotalSpend, setHouseholdTotalSpend] = useState(0);

  const [detailLoading, setDetailLoading] = useState(false);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);
  const [documents, setDocuments] = useState<WestyDocument[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const [requests, setRequests] = useState<Record<string, RequestState>>({});
  const [activeDialogKey, setActiveDialogKey] = useState<string | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ personName: string; member: CareTeamMember } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const me = await mockWestyClient.getPerson(user.personId);
      const householdMembers = await mockWestyClient.listHouseholdMembers(me.householdId);
      setUserId(user.id);
      setMembers(householdMembers);
      setSelectedId((prev) => prev ?? householdMembers[0]?.id ?? null);

      const perMember = await Promise.all(
        householdMembers.map(async (person) => {
          const bills = await mockWestyClient.listBills(person.id);
          const billsCharges = await Promise.all(bills.map((bill) => mockWestyClient.getCharges(bill.chargeIds)));
          const spend = billsCharges.reduce((sum, charges) => sum + billFinancials(charges).billed, 0);
          return [person.id, spend] as const;
        })
      );
      setSpendByMember(Object.fromEntries(perMember));
      setHouseholdTotalSpend(perMember.reduce((sum, [, spend]) => sum + spend, 0));
    })();
  }, []);

  async function loadDetail(personId: string) {
    setDetailLoading(true);
    const [team, docs, eps] = await Promise.all([
      mockWestyClient.listCareTeam(personId),
      mockWestyClient.listDocuments(personId),
      mockWestyClient.listEpisodes(personId),
    ]);
    setCareTeam(team);
    setDocuments(docs);
    setEpisodes(eps);
    setDetailLoading(false);
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  async function refreshCareTeam() {
    if (!selectedId) return;
    setCareTeam(await mockWestyClient.listCareTeam(selectedId));
  }

  function pollRequest(key: string, requestId: string) {
    const interval = setInterval(async () => {
      const updated = await mockWestyClient.getAppointmentRequest(requestId);
      if (updated.status === "searching") {
        setRequests((prev) => ({ ...prev, [key]: { status: "searching" } }));
      } else if (updated.status === "proposed" && updated.proposedSlots) {
        setRequests((prev) => ({ ...prev, [key]: { status: "proposed", requestId, slots: updated.proposedSlots! } }));
        setActiveDialogKey(key);
        clearInterval(interval);
      } else if (updated.status !== "submitted") {
        clearInterval(interval);
      }
    }, 500);
    intervalsRef.current.push(interval);
  }

  async function handleSchedule(personId: string, member: CareTeamMember) {
    setRequests((prev) => ({ ...prev, [member.id]: { status: "submitted" } }));
    const providerId = CARE_TEAM_PROVIDER_ID[member.id];
    const request = await mockWestyClient.requestAppointment({
      personId,
      requestedByUserId: userId,
      providerId,
      reason: `${member.role} appointment`,
      constraints: {},
    });
    pollRequest(member.id, request.id);
  }

  async function handleConfirm(key: string, requestId: string, slot: ProposedSlot) {
    setRequests((prev) => ({ ...prev, [key]: { status: "confirming" } }));
    const appointment = await mockWestyClient.confirmAppointmentSlot(requestId, slot);
    setRequests((prev) => ({ ...prev, [key]: { status: "booked", appointment } }));
    // Dialog stays open — the user needs to see the success confirmation
    // (with the real booked date/time) before dismissing it themselves.
  }

  function openAddForm(personId: string) {
    setFormValues(EMPTY_FORM);
    setFormTarget({ mode: "add", personId });
  }

  function openEditForm(personId: string, member: CareTeamMember) {
    setFormValues({
      name: member.name,
      role: member.role,
      organization: member.organization ?? "",
      phone: member.phone ?? "",
      email: member.email ?? "",
      website: member.website ?? "",
      address: member.address ?? "",
    });
    setFormTarget({ mode: "edit", personId, memberId: member.id });
  }

  async function handleSubmitForm() {
    if (!formTarget) return;
    setSavingForm(true);
    const input = formToInput(formTarget.personId, formValues);
    if (formTarget.mode === "add") {
      await mockWestyClient.addCareTeamMember(input);
    } else {
      await mockWestyClient.updateCareTeamMember(formTarget.memberId, input);
    }
    setSavingForm(false);
    setFormTarget(null);
    await refreshCareTeam();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await mockWestyClient.removeCareTeamMember(deleteTarget.member.id);
    setDeleting(false);
    setDeleteTarget(null);
    await refreshCareTeam();
  }

  const selectedMember = members?.find((m) => m.id === selectedId) ?? null;
  const selectedSpend = selectedId ? spendByMember[selectedId] ?? 0 : 0;
  const spendPct = householdTotalSpend > 0 ? Math.round((selectedSpend / householdTotalSpend) * 100) : 0;

  const activeRequest = activeDialogKey ? requests[activeDialogKey] : null;
  const dialogOpen =
    activeDialogKey !== null &&
    (activeRequest?.status === "proposed" ||
      activeRequest?.status === "confirming" ||
      activeRequest?.status === "booked");
  const dialogTitle =
    activeRequest?.status === "confirming"
      ? "Booking your appointment"
      : activeRequest?.status === "booked"
        ? "Appointment booked"
        : "Schedule with Westy";

  const formValid = formValues.name.trim() !== "" && formValues.role.trim() !== "";

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household", active: true },
          { label: "Appointments", href: "/appointments" },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
        trailing={<UserAvatar />}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 1080,
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
            <Skeleton height={200} />
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" }}>
              {members.map((person, i) => {
                const selected = person.id === selectedId;
                return (
                  <Card
                    key={person.id}
                    elevation="sm"
                    style={{
                      cursor: "pointer",
                      alignItems: "flex-start",
                      border: selected ? "2px solid var(--color-accent)" : "1px solid transparent",
                    }}
                    onClick={() => setSelectedId(person.id)}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        color: "var(--color-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      {initials(person)}
                    </div>
                    <CardTitle>
                      {person.firstName} {person.lastName}
                    </CardTitle>
                    <CardBody>{personSubtitle(person)}</CardBody>
                  </Card>
                );
              })}
            </div>

            <div className="hr" />

            {selectedMember && (
              <>
                <Card style={{ maxWidth: 320 }}>
                  <CardKicker>Spend this year</CardKicker>
                  <CardTitle>{formatMoney(selectedSpend)}</CardTitle>
                  <div style={{ height: 6, background: "var(--color-neutral-200)", marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${spendPct}%`, background: "var(--color-accent)" }} />
                  </div>
                  <CardBody>
                    Share of {formatMoney(householdTotalSpend)} spent by the household this year
                  </CardBody>
                </Card>

                {detailLoading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
                    <Skeleton height={140} />
                    <Skeleton height={140} />
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
                    <section>
                      <SectionLabel>{selectedMember.firstName}&apos;s care team</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                        {careTeam.length === 0 && (
                          <p className="text-muted" style={{ fontSize: 13 }}>
                            No care team on file yet.
                          </p>
                        )}
                        {careTeam.map((member) => {
                          const state = requests[member.id] ?? { status: "idle" as const };
                          return (
                            <Card key={member.id} style={{ gap: "var(--space-2)" }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                                <CardMeta>
                                  {member.role}
                                  {member.organization ? ` · ${member.organization}` : ""}
                                </CardMeta>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {member.phone && <CardMeta>{member.phone}</CardMeta>}
                                {member.email && <CardMeta>{member.email}</CardMeta>}
                                {member.website && <CardMeta>{member.website}</CardMeta>}
                                {member.address && <CardMeta>{member.address}</CardMeta>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                                {state.status === "idle" && (
                                  <Button variant="ghost" onClick={() => handleSchedule(selectedMember.id, member)}>
                                    Schedule with Westy
                                  </Button>
                                )}
                                {state.status === "submitted" && <CardMeta>Submitting request…</CardMeta>}
                                {state.status === "searching" && (
                                  <CardMeta>Searching {member.name}&apos;s availability…</CardMeta>
                                )}
                                {state.status === "proposed" && (
                                  <Button variant="ghost" onClick={() => setActiveDialogKey(member.id)}>
                                    View proposed times
                                  </Button>
                                )}
                                {state.status === "confirming" && <CardMeta>Booking…</CardMeta>}
                                {state.status === "booked" && (
                                  <CardMeta>Booked for {formatSlot(state.appointment.scheduledFor)}</CardMeta>
                                )}
                                <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
                                  <Button variant="ghost" onClick={() => openEditForm(selectedMember.id, member)}>
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      setDeleteTarget({
                                        personName: `${selectedMember.firstName} ${selectedMember.lastName}`,
                                        member,
                                      })
                                    }
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                      <Button variant="ghost" onClick={() => openAddForm(selectedMember.id)}>
                        + Add provider
                      </Button>
                    </section>

                    <section>
                      <SectionLabel>{selectedMember.firstName}&apos;s documents</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {documents.length === 0 && (
                          <p className="text-muted" style={{ fontSize: 13 }}>
                            No documents on file yet.
                          </p>
                        )}
                        {documents.map((doc) => (
                          <Card key={doc.id} style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{DOC_TYPE_LABEL[doc.type]}</div>
                              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{DOC_SOURCE_LABEL}</div>
                            </div>
                            <DocumentStatusTag status={doc.status} />
                          </Card>
                        ))}
                      </div>

                      {episodes
                        .filter((e) => e.status === "active")
                        .map((episode) => (
                          <Link
                            key={episode.id}
                            href={`/episodes/${episode.id}`}
                            style={{ display: "block", textDecoration: "none", color: "inherit", marginTop: "var(--space-3)" }}
                          >
                            <div
                              style={{
                                background: "var(--color-accent-100)",
                                border: "1px solid var(--color-accent-300)",
                                padding: 14,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  color: "var(--color-accent-700)",
                                  marginBottom: 4,
                                }}
                              >
                                Open episode
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{episode.title}</div>
                              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                                Timeline, documents and tasks for this episode
                              </div>
                            </div>
                          </Link>
                        ))}
                    </section>
                  </div>
                )}
              </>
            )}

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

      <Dialog
        open={dialogOpen}
        title={dialogTitle}
        onDismiss={activeRequest?.status === "confirming" ? undefined : () => setActiveDialogKey(null)}
        actions={
          activeRequest?.status === "proposed" ? (
            <Button variant="ghost" onClick={() => setActiveDialogKey(null)}>
              Close
            </Button>
          ) : activeRequest?.status === "booked" ? (
            <Button variant="primary" onClick={() => setActiveDialogKey(null)}>
              Done
            </Button>
          ) : undefined
        }
      >
        {activeRequest?.status === "proposed" && activeDialogKey && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {activeRequest.slots.map((slot, i) => (
              <Button
                key={i}
                variant="secondary"
                block
                onClick={() => handleConfirm(activeDialogKey, activeRequest.requestId, slot)}
              >
                {formatSlot(slot.datetime)}
              </Button>
            ))}
          </div>
        )}
        {activeRequest?.status === "confirming" && (
          <AiSurface>
            <p style={{ margin: 0 }}>Confirming and booking your appointment…</p>
          </AiSurface>
        )}
        {activeRequest?.status === "booked" && (
          <AiSurface>
            <p style={{ margin: 0 }}>
              Booked for {formatSlot(activeRequest.appointment.scheduledFor)}. It&apos;ll show up in your Dashboard&apos;s
              upcoming appointments.
            </p>
          </AiSurface>
        )}
      </Dialog>

      <Dialog
        open={formTarget !== null}
        title={formTarget?.mode === "add" ? "Add a provider" : "Edit provider"}
        onDismiss={() => setFormTarget(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setFormTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!formValid || savingForm} onClick={handleSubmitForm}>
              {formTarget?.mode === "add" ? "Add provider" : "Save changes"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Field label="Name" htmlFor="providerName">
            <TextInput
              id="providerName"
              value={formValues.name}
              onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field label="Role" htmlFor="providerRole">
            <TextInput
              id="providerRole"
              placeholder="e.g. Primary Care Physician"
              value={formValues.role}
              onChange={(e) => setFormValues((v) => ({ ...v, role: e.target.value }))}
            />
          </Field>
          <Field label="Organization" htmlFor="providerOrganization">
            <TextInput
              id="providerOrganization"
              value={formValues.organization}
              onChange={(e) => setFormValues((v) => ({ ...v, organization: e.target.value }))}
            />
          </Field>
          <Field label="Phone" htmlFor="providerPhone">
            <TextInput
              id="providerPhone"
              type="tel"
              value={formValues.phone}
              onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))}
            />
          </Field>
          <Field label="Email" htmlFor="providerEmail">
            <TextInput
              id="providerEmail"
              type="email"
              value={formValues.email}
              onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
            />
          </Field>
          <Field label="Website" htmlFor="providerWebsite">
            <TextInput
              id="providerWebsite"
              placeholder="https://…"
              value={formValues.website}
              onChange={(e) => setFormValues((v) => ({ ...v, website: e.target.value }))}
            />
          </Field>
          <Field label="Address" htmlFor="providerAddress">
            <TextInput
              id="providerAddress"
              value={formValues.address}
              onChange={(e) => setFormValues((v) => ({ ...v, address: e.target.value }))}
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        title="Remove provider"
        onDismiss={() => setDeleteTarget(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={deleting} onClick={handleDelete}>
              Remove
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          Remove {deleteTarget?.member.name} from {deleteTarget?.personName}&apos;s care team?
        </p>
      </Dialog>
    </>
  );
}
