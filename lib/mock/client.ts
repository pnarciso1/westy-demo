import type {
  User,
  Household,
  Person,
  OnboardingSession,
  OnboardingStep,
  Connector,
  Document as WestyDocument,
  Episode,
  EpisodeSuggestion,
  Appointment,
  AppointmentRequest,
  Bill,
  Anomaly,
  Charge,
  CareTeamMember,
  ChatMessage,
  PersonalDataExport,
  Task,
} from "@westy/shared";
import type {
  WestyClient,
  StartOnboardingInput,
  AddFamilyMemberInput,
  InitiateConnectorInput,
  UploadDocumentInput,
  RequestAppointmentInput,
  ProposedSlot,
  DashboardSummary,
} from "@westy/shared/client";
import { createInitialState, type MockState } from "./state";
import { delay } from "./delay";

/**
 * The one scripted failure in the demo: no provider_portal integration
 * actually exists yet, for any provider, for anyone. Every provider_portal
 * connector resolves to "error" — including on retry — which is what makes
 * the upload-fallback path the natural next move in the demo, not a dead
 * end the rep has to explain away. payer and hsa_fsa_card connectors always
 * succeed.
 */
function isScriptedFailure(input: { ownerPersonId: string; type: Connector["type"] }): boolean {
  return input.type === "provider_portal";
}

function notFound(kind: string, id: string): never {
  throw new Error(`${kind} not found: ${id}`);
}

export class MockWestyClient implements WestyClient {
  private state: MockState;

  constructor() {
    this.state = createInitialState();
  }

  /** Rep-only control — restores the seeded persona to its starting state. Not part of WestyClient. */
  resetDemo(): void {
    this.state = createInitialState();
  }

  private genId(prefix: string): string {
    return `${prefix}-${this.state.nextId++}`;
  }

  // ── Identity & household ────────────────────────────────────────────
  async getCurrentUser(): Promise<User> {
    await delay(200);
    return this.state.user;
  }

  async getHousehold(householdId: string): Promise<Household> {
    await delay(200);
    if (this.state.household.id !== householdId) notFound("Household", householdId);
    return this.state.household;
  }

  async getPerson(personId: string): Promise<Person> {
    await delay(150);
    return this.state.people.find((p) => p.id === personId) ?? notFound("Person", personId);
  }

  async listHouseholdMembers(householdId: string): Promise<Person[]> {
    await delay(200);
    if (this.state.household.id !== householdId) notFound("Household", householdId);
    return this.state.people;
  }

  // ── Onboarding ───────────────────────────────────────────────────────
  /**
   * DEMO-ONLY BEHAVIOR — not representative of real production onboarding.
   * Every onboarding run resets to the seeded Ramirez household, then
   * overwrites the seeded coordinator (Maria's Person record) with whatever
   * the rep types in Step 1, keeping her existing id. This means the
   * household's episodes, bills, and appointments — all seeded against
   * "person-maria" etc. — stay attached and visible on the Dashboard
   * immediately after onboarding, instead of onboarding producing an empty,
   * disconnected household. See `addFamilyMember` below for the same
   * pattern applied to the other seeded family members.
   */
  async startOnboarding(input: StartOnboardingInput): Promise<OnboardingSession> {
    await delay(400);
    this.resetDemo();
    const coordinator = this.state.people[0];
    coordinator.firstName = input.firstName;
    coordinator.lastName = input.lastName;
    coordinator.dateOfBirth = input.dateOfBirth;
    const session: OnboardingSession = {
      id: this.genId("onboarding"),
      userId: this.state.user.id,
      householdId: this.state.household.id,
      startedAt: new Date().toISOString(),
      steps: [
        { step: "account", status: "complete" },
        { step: "family_members", status: "pending", addedPersonIds: [] },
        { step: "connect_or_upload", status: "pending", connectorIds: [], documentIds: [] },
      ],
    };
    this.state.onboardingSessions.set(session.id, session);
    return session;
  }

  async getOnboardingSession(sessionId: string): Promise<OnboardingSession> {
    await delay(150);
    return this.state.onboardingSessions.get(sessionId) ?? notFound("OnboardingSession", sessionId);
  }

  /**
   * DEMO-ONLY BEHAVIOR — not representative of real production onboarding.
   * The first three family members entered during onboarding are matched by
   * POSITION onto the seeded non-coordinator Ramirez members (David, then
   * Sofia, then Diego) and overwrite their name/DOB in place, keeping their
   * existing ids — this is what keeps their seeded episodes, bills, and
   * appointments attached and visible on the Dashboard. A 4th+ family
   * member (beyond the seeded household's 3 dependents) falls back to
   * creating a genuinely new, disconnected Person record.
   */
  async addFamilyMember(sessionId: string, input: AddFamilyMemberInput): Promise<OnboardingSession> {
    await delay(300);
    const session = this.state.onboardingSessions.get(sessionId) ?? notFound("OnboardingSession", sessionId);
    const step = session.steps.find(
      (s): s is Extract<OnboardingStep, { step: "family_members" }> => s.step === "family_members"
    );
    const position = step ? step.addedPersonIds.length : 0;
    const seededNonCoordinator = this.state.people.slice(1, 4);
    let personId: string;
    if (position < seededNonCoordinator.length) {
      const person = seededNonCoordinator[position];
      person.firstName = input.firstName;
      person.lastName = input.lastName;
      person.dateOfBirth = input.dateOfBirth;
      personId = person.id;
    } else {
      const newPerson: Person = {
        id: this.genId("person"),
        householdId: this.state.household.id,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        relationshipToCoordinator: input.relationshipToCoordinator,
        financialAccess: "coordinator",
        fhirPatientId: this.genId("fhir-patient"),
      };
      this.state.people.push(newPerson);
      personId = newPerson.id;
    }
    if (step) {
      step.addedPersonIds = [...step.addedPersonIds, personId];
    }
    return session;
  }

  async advanceOnboardingStep(sessionId: string, step: OnboardingStep): Promise<OnboardingSession> {
    await delay(250);
    const session = this.state.onboardingSessions.get(sessionId) ?? notFound("OnboardingSession", sessionId);
    const index = session.steps.findIndex((s) => s.step === step.step);
    if (index >= 0) {
      session.steps[index] = step;
    } else {
      session.steps.push(step);
    }
    return session;
  }

  async completeOnboarding(sessionId: string): Promise<OnboardingSession> {
    await delay(300);
    const session = this.state.onboardingSessions.get(sessionId) ?? notFound("OnboardingSession", sessionId);
    session.steps.push({ step: "complete" });
    session.completedAt = new Date().toISOString();
    return session;
  }

  // ── Dashboard ────────────────────────────────────────────────────────
  async getDashboard(personId: string): Promise<DashboardSummary> {
    await delay(500);
    void personId; // this demo's dashboard is household-wide, matching the seeded Ramirez view
    return {
      household: this.state.household,
      members: this.state.people,
      flaggedBills: this.state.bills.filter((b) => b.status === "flagged"),
      openTasks: this.state.tasks.filter((t) => t.status === "open"),
      highlightedEpisodes: this.state.episodes.filter((e) => e.status === "active"),
      pendingConnectors: this.state.connectors.filter((c) => c.status === "pending"),
      pendingEpisodeSuggestions: this.state.episodeSuggestions.filter((s) => s.status === "pending"),
    };
  }

  // ── Connector module ─────────────────────────────────────────────────
  async listConnectors(personId: string): Promise<Connector[]> {
    await delay(200);
    return this.state.connectors.filter((c) => c.ownerPersonId === personId);
  }

  async initiateConnector(input: InitiateConnectorInput): Promise<Connector> {
    await delay(250);
    const connector: Connector = {
      id: this.genId("connector"),
      ownerPersonId: input.ownerPersonId,
      type: input.type,
      vendor: input.vendor,
      status: "pending",
      credentialRef: this.genId("vault-ref"),
    };
    this.state.connectors.push(connector);
    this.resolveConnectorInBackground(connector.id, input);
    return connector;
  }

  /** Fires after a realistic delay so the UI can show a genuine "connecting…" state before resolving. */
  private resolveConnectorInBackground(connectorId: string, input: InitiateConnectorInput): void {
    delay(1800).then(() => {
      const connector = this.state.connectors.find((c) => c.id === connectorId);
      if (!connector) return;
      if (isScriptedFailure(input)) {
        connector.status = "error";
        connector.syncError = `${input.vendor} doesn't support direct connections yet — try uploading a bill or insurance summary instead.`;
      } else {
        connector.status = "connected";
        connector.lastSyncedAt = new Date().toISOString();
      }
    });
  }

  async getConnector(connectorId: string): Promise<Connector> {
    await delay(150);
    return this.state.connectors.find((c) => c.id === connectorId) ?? notFound("Connector", connectorId);
  }

  async retryConnector(connectorId: string): Promise<Connector> {
    await delay(200);
    const connector = this.state.connectors.find((c) => c.id === connectorId) ?? notFound("Connector", connectorId);
    connector.status = "pending";
    connector.syncError = undefined;
    // Retrying the scripted failure fails again, deterministically — this
    // provider genuinely doesn't have an integration, retrying wouldn't help.
    this.resolveConnectorInBackground(connectorId, {
      ownerPersonId: connector.ownerPersonId,
      type: connector.type,
      vendor: connector.vendor,
    });
    return connector;
  }

  async disconnectConnector(connectorId: string): Promise<Connector> {
    await delay(200);
    const connector = this.state.connectors.find((c) => c.id === connectorId) ?? notFound("Connector", connectorId);
    connector.status = "disconnected";
    return connector;
  }

  // ── Documents ────────────────────────────────────────────────────────
  async uploadDocument(input: UploadDocumentInput): Promise<WestyDocument> {
    await delay(300);
    const document: WestyDocument = {
      id: this.genId("doc"),
      personId: input.personId,
      type: input.type,
      status: "uploaded",
    };
    this.state.documents.push(document);
    this.resolveDocumentInBackground(document.id);
    return document;
  }

  private resolveDocumentInBackground(documentId: string): void {
    delay(1200)
      .then(() => {
        const doc = this.state.documents.find((d) => d.id === documentId);
        if (doc) doc.status = "processing";
        return delay(1800);
      })
      .then(() => {
        const doc = this.state.documents.find((d) => d.id === documentId);
        if (doc) {
          doc.status = "extracted";
          doc.extracted = { note: "Simulated extraction for demo purposes" };
        }
      });
  }

  async getDocument(documentId: string): Promise<WestyDocument> {
    await delay(150);
    return this.state.documents.find((d) => d.id === documentId) ?? notFound("Document", documentId);
  }

  async listDocuments(personId: string, episodeId?: string): Promise<WestyDocument[]> {
    await delay(200);
    return this.state.documents.filter(
      (d) => d.personId === personId && (episodeId ? d.episodeId === episodeId : true)
    );
  }

  // ── Episodes ─────────────────────────────────────────────────────────
  async listEpisodes(personId: string): Promise<Episode[]> {
    await delay(250);
    return this.state.episodes.filter((e) => e.personId === personId);
  }

  async getEpisode(episodeId: string): Promise<Episode> {
    await delay(200);
    return this.state.episodes.find((e) => e.id === episodeId) ?? notFound("Episode", episodeId);
  }

  async listEpisodeSuggestions(personId: string): Promise<EpisodeSuggestion[]> {
    await delay(200);
    return this.state.episodeSuggestions.filter((s) => s.personId === personId && s.status === "pending");
  }

  async acceptEpisodeSuggestion(suggestionId: string): Promise<Episode> {
    await delay(300);
    const suggestion =
      this.state.episodeSuggestions.find((s) => s.id === suggestionId) ?? notFound("EpisodeSuggestion", suggestionId);
    suggestion.status = "accepted";
    const episode: Episode = {
      id: this.genId("episode"),
      personId: suggestion.personId,
      title: suggestion.suggestedTitle,
      status: "active",
      startedOn: new Date().toISOString(),
      providerIds: [],
      documentIds: suggestion.documentIds,
      taskIds: [],
      appointmentIds: suggestion.appointmentIds,
      formation: "system_suggested",
    };
    this.state.episodes.push(episode);
    return episode;
  }

  async dismissEpisodeSuggestion(suggestionId: string): Promise<void> {
    await delay(200);
    const suggestion =
      this.state.episodeSuggestions.find((s) => s.id === suggestionId) ?? notFound("EpisodeSuggestion", suggestionId);
    suggestion.status = "dismissed";
  }

  // ── Appointments & agentic scheduling ────────────────────────────────
  async listAppointments(personId: string): Promise<Appointment[]> {
    await delay(250);
    return this.state.appointments.filter((a) => a.personId === personId);
  }

  async requestAppointment(input: RequestAppointmentInput): Promise<AppointmentRequest> {
    await delay(300);
    const request: AppointmentRequest = {
      id: this.genId("apptreq"),
      personId: input.personId,
      requestedByUserId: input.requestedByUserId,
      providerId: input.providerId,
      reason: input.reason,
      constraints: input.constraints,
      status: "submitted",
    };
    this.state.appointmentRequests.set(request.id, request);
    this.resolveAppointmentRequestInBackground(request.id);
    return request;
  }

  private resolveAppointmentRequestInBackground(requestId: string): void {
    delay(1000)
      .then(() => {
        const req = this.state.appointmentRequests.get(requestId);
        if (req) req.status = "searching";
        return delay(1500);
      })
      .then(() => {
        const req = this.state.appointmentRequests.get(requestId);
        if (!req) return;
        req.status = "proposed";
        const base = Date.now() + 1000 * 60 * 60 * 24 * 7;
        req.proposedSlots = [
          { providerId: req.providerId ?? "provider-unassigned", datetime: new Date(base).toISOString() },
          { providerId: req.providerId ?? "provider-unassigned", datetime: new Date(base + 86400000).toISOString() },
        ];
      });
  }

  async getAppointmentRequest(requestId: string): Promise<AppointmentRequest> {
    await delay(150);
    return this.state.appointmentRequests.get(requestId) ?? notFound("AppointmentRequest", requestId);
  }

  async confirmAppointmentSlot(requestId: string, slot: ProposedSlot): Promise<Appointment> {
    await delay(300);
    const request = this.state.appointmentRequests.get(requestId) ?? notFound("AppointmentRequest", requestId);
    const appointment: Appointment = {
      id: this.genId("appt"),
      personId: request.personId,
      providerId: slot.providerId,
      scheduledFor: slot.datetime,
      status: "scheduled",
      reason: request.reason,
      bookedVia: "agent",
      appointmentRequestId: request.id,
    };
    this.state.appointments.push(appointment);
    request.status = "confirmed";
    request.resultingAppointmentId = appointment.id;
    return appointment;
  }

  // ── Billing ──────────────────────────────────────────────────────────
  async listBills(personId: string): Promise<Bill[]> {
    await delay(250);
    return this.state.bills.filter((b) => b.personId === personId);
  }

  async getBill(billId: string): Promise<Bill> {
    await delay(200);
    return this.state.bills.find((b) => b.id === billId) ?? notFound("Bill", billId);
  }

  async getCharges(chargeIds: string[]): Promise<Charge[]> {
    await delay(200);
    return chargeIds.map((id) => this.state.charges.find((c) => c.id === id) ?? notFound("Charge", id));
  }

  async getAnomaly(anomalyId: string): Promise<Anomaly> {
    await delay(200);
    return this.state.anomalies.find((a) => a.id === anomalyId) ?? notFound("Anomaly", anomalyId);
  }

  async payBill(billId: string): Promise<Bill> {
    await delay(400);
    const bill = this.state.bills.find((b) => b.id === billId) ?? notFound("Bill", billId);
    bill.status = "paid";
    return bill;
  }

  async disputeBill(billId: string, reason?: string): Promise<Bill> {
    await delay(400);
    const bill = this.state.bills.find((b) => b.id === billId) ?? notFound("Bill", billId);
    bill.status = "disputed";
    void reason; // Bill has no reason field in the domain model — logged by the caller/UI if needed
    return bill;
  }

  // ── Care team & tasks ────────────────────────────────────────────────
  async listCareTeam(personId: string): Promise<CareTeamMember[]> {
    await delay(200);
    return this.state.careTeam.filter((c) => c.personId === personId);
  }

  async listTasks(personId: string): Promise<Task[]> {
    await delay(200);
    return this.state.tasks.filter((t) => t.personId === personId);
  }

  async completeTask(taskId: string): Promise<Task> {
    await delay(250);
    const task = this.state.tasks.find((t) => t.id === taskId) ?? notFound("Task", taskId);
    task.status = "complete";
    return task;
  }

  // ── Ask Westy ────────────────────────────────────────────────────────
  async getChatThread(personId: string): Promise<import("@westy/shared").ChatThread> {
    await delay(200);
    const existing = this.state.chatThreads.get(personId);
    if (existing) return existing;
    const thread = { id: this.genId("chat"), personId, messages: [] };
    this.state.chatThreads.set(personId, thread);
    return thread;
  }

  async sendChatMessage(personId: string, text: string): Promise<ChatMessage> {
    const thread = await this.getChatThread(personId);
    const userMessage: ChatMessage = { id: this.genId("msg"), role: "user", text, isAiGenerated: false };
    thread.messages.push(userMessage);
    await delay(900); // simulated "thinking" time before the reply
    const reply: ChatMessage = {
      id: this.genId("msg"),
      role: "assistant",
      text: "That's a demo response — Ask Westy's real grounding against your household's data isn't wired up in this mock yet.",
      isAiGenerated: true,
    };
    thread.messages.push(reply);
    return reply;
  }

  // ── Data portability ─────────────────────────────────────────────────
  async requestDataExport(personId: string): Promise<PersonalDataExport> {
    await delay(300);
    const exportRecord: PersonalDataExport = {
      id: this.genId("export"),
      personId,
      requestedAt: new Date().toISOString(),
      status: "pending",
      contents: {
        fhirBundleUrl: "",
        financialLedger: [],
        documents: [],
        appointments: [],
        chatHistory: [],
      },
    };
    this.state.dataExports.set(exportRecord.id, exportRecord);
    this.resolveDataExportInBackground(exportRecord.id, personId);
    return exportRecord;
  }

  private resolveDataExportInBackground(exportId: string, personId: string): void {
    delay(2000).then(() => {
      const record = this.state.dataExports.get(exportId);
      if (!record) return;
      record.status = "ready";
      record.contents = {
        fhirBundleUrl: `https://demo.westy.example/exports/${exportId}/fhir-bundle.json`,
        financialLedger: [],
        documents: this.state.documents.filter((d) => d.personId === personId),
        appointments: this.state.appointments.filter((a) => a.personId === personId),
        chatHistory: this.state.chatThreads.get(personId)?.messages ?? [],
      };
      record.downloadUrl = `https://demo.westy.example/exports/${exportId}/download`;
      record.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    });
  }

  async getDataExport(exportId: string): Promise<PersonalDataExport> {
    await delay(150);
    return this.state.dataExports.get(exportId) ?? notFound("PersonalDataExport", exportId);
  }
}
