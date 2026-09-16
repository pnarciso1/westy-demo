"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardMeta, Button, Dialog, Field, TextInput, Skeleton, SectionLabel, AiSurface } from "@westy/shared/ui";
import type { Appointment, CareTeamMember, Person } from "@westy/shared";
import type { AddCareTeamMemberInput, ProposedSlot } from "@westy/shared/client";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient, CARE_TEAM_PROVIDER_ID } from "@/lib/mock";

type RequestState =
  | { status: "idle" }
  | { status: "submitted" | "searching" }
  | { status: "proposed"; requestId: string; slots: ProposedSlot[] }
  | { status: "confirming" }
  | { status: "booked"; appointment: Appointment };

type Group = { person: Person; team: CareTeamMember[] };

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

export default function CareTeam() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<Record<string, RequestState>>({});
  const [activeDialogKey, setActiveDialogKey] = useState<string | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ personName: string; member: CareTeamMember } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadGroups() {
    const user = await mockWestyClient.getCurrentUser();
    const me = await mockWestyClient.getPerson(user.personId);
    const members = await mockWestyClient.listHouseholdMembers(me.householdId);
    const withTeams = await Promise.all(
      members.map(async (person) => ({ person, team: await mockWestyClient.listCareTeam(person.id) }))
    );
    setUserId(user.id);
    setGroups(withTeams);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

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

  async function handleRequest(personId: string, member: CareTeamMember) {
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
    await loadGroups();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await mockWestyClient.removeCareTeamMember(deleteTarget.member.id);
    setDeleting(false);
    setDeleteTarget(null);
    await loadGroups();
  }

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
        : "Choose a time";

  const formValid = formValues.name.trim() !== "" && formValues.role.trim() !== "";

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Care Team", href: "/care-team", active: true },
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
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>My Care Team</h1>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Every provider caring for your household, in one place.
          </p>
        </div>

        {!groups ? (
          <>
            <Skeleton height={100} />
            <Skeleton height={100} />
          </>
        ) : (
          groups.map(({ person, team }) => (
            <section key={person.id}>
              <SectionLabel>
                {person.firstName} {person.lastName}
              </SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                {team.length === 0 && (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    No care team on file yet.
                  </p>
                )}
                {team.map((member) => {
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
                          <Button variant="secondary" onClick={() => handleRequest(person.id, member)}>
                            Request appointment
                          </Button>
                        )}
                        {state.status === "submitted" && <CardMeta>Submitting request…</CardMeta>}
                        {state.status === "searching" && (
                          <CardMeta>Searching {member.name}&apos;s availability…</CardMeta>
                        )}
                        {state.status === "proposed" && (
                          <Button variant="secondary" onClick={() => setActiveDialogKey(member.id)}>
                            View proposed times
                          </Button>
                        )}
                        {state.status === "confirming" && <CardMeta>Booking…</CardMeta>}
                        {state.status === "booked" && (
                          <CardMeta>Booked for {formatSlot(state.appointment.scheduledFor)}</CardMeta>
                        )}
                        <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
                          <Button variant="ghost" onClick={() => openEditForm(person.id, member)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleteTarget({ personName: `${person.firstName} ${person.lastName}`, member })}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Button variant="ghost" onClick={() => openAddForm(person.id)}>
                + Add provider
              </Button>
            </section>
          ))
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
