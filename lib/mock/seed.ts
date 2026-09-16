import type {
  User,
  Household,
  Person,
  Episode,
  EpisodeSuggestion,
  Appointment,
  Bill,
  Anomaly,
  Charge,
  Document as WestyDocument,
  CareTeamMember,
  Connector,
  ChatThread,
  Task,
} from "@westy/shared";

/**
 * The demo's single persona: the Ramirez household. Chosen to show depth
 * across the domain model rather than breadth across many households —
 * per the decision to run one complex, multi-episode family case.
 *
 * - Maria: coordinator; has a flagged bill with a real Anomaly (surprise
 *   billing) to demonstrate the billing/anomaly flow.
 * - David: an ongoing chronic-care episode (diabetes management) —
 *   recurring, not a single incident, to contrast with Sofia's case below.
 * - Sofia: the arm-fracture episode — ER visit, follow-up, cast removal,
 *   all grouped under one Episode. This is the "accident requiring
 *   follow-up care" example from the domain model discussion.
 * - Diego: deliberately has NO connected connector yet — this is who the
 *   scripted connector-failure-and-upload-fallback moment runs against.
 */

export const SEED_USER: User = {
  id: "user-maria",
  authProvider: "google",
  email: "maria.ramirez@example.com",
  createdAt: "2026-01-15T09:00:00.000Z",
  role: "coordinator",
  personId: "person-maria",
};

export const SEED_HOUSEHOLD: Household = {
  id: "hh-ramirez",
  name: "Ramirez Household",
  primaryUserId: "user-maria",
  memberIds: ["person-maria", "person-david", "person-sofia", "person-diego"],
  createdAt: "2026-01-15T09:00:00.000Z",
};

export const SEED_PEOPLE: Person[] = [
  {
    id: "person-maria",
    householdId: "hh-ramirez",
    firstName: "Maria",
    lastName: "Ramirez",
    dateOfBirth: "1985-03-12",
    relationshipToCoordinator: "self",
    financialAccess: "coordinator",
    fhirPatientId: "fhir-patient-maria",
  },
  {
    id: "person-david",
    householdId: "hh-ramirez",
    firstName: "David",
    lastName: "Ramirez",
    dateOfBirth: "1983-07-22",
    relationshipToCoordinator: "spouse",
    financialAccess: "shared",
    fhirPatientId: "fhir-patient-david",
  },
  {
    id: "person-sofia",
    householdId: "hh-ramirez",
    firstName: "Sofia",
    lastName: "Ramirez",
    dateOfBirth: "2017-11-02",
    relationshipToCoordinator: "child",
    financialAccess: "coordinator",
    fhirPatientId: "fhir-patient-sofia",
  },
  {
    id: "person-diego",
    householdId: "hh-ramirez",
    firstName: "Diego",
    // Deliberately a different last name — exercises Person.lastName being
    // independent per the domain model, not inherited from the household.
    lastName: "Ramirez-Nunez",
    dateOfBirth: "2019-05-18",
    relationshipToCoordinator: "child",
    financialAccess: "coordinator",
    fhirPatientId: "fhir-patient-diego",
  },
];

export const SEED_EPISODES: Episode[] = [
  {
    id: "episode-sofia-arm",
    personId: "person-sofia",
    title: "Arm Fracture",
    status: "active",
    startedOn: "2026-08-02",
    providerIds: ["provider-er", "provider-ortho"],
    documentIds: ["doc-sofia-er-summary", "doc-sofia-xray"],
    taskIds: ["task-sofia-followup"],
    appointmentIds: ["appt-sofia-er", "appt-sofia-followup", "appt-sofia-cast-removal"],
    formation: "user_initiated",
  },
  {
    id: "episode-david-diabetes",
    personId: "person-david",
    title: "Diabetes Management",
    status: "active",
    startedOn: "2025-02-10",
    providerIds: ["provider-endo"],
    documentIds: ["doc-david-labs"],
    taskIds: [],
    appointmentIds: ["appt-david-checkup-past", "appt-david-checkup-upcoming"],
    formation: "user_initiated",
  },
];

export const SEED_EPISODE_SUGGESTIONS: EpisodeSuggestion[] = [
  {
    id: "suggestion-diego-wellness",
    personId: "person-diego",
    suggestedTitle: "Well-Child Visits",
    appointmentIds: ["appt-diego-wellness"],
    documentIds: [],
    status: "pending",
  },
];

export const SEED_APPOINTMENTS: Appointment[] = [
  {
    id: "appt-sofia-er",
    personId: "person-sofia",
    providerId: "provider-er",
    episodeId: "episode-sofia-arm",
    scheduledFor: "2026-08-02T14:30:00.000Z",
    status: "completed",
    reason: "Fall from playground equipment",
    bookedVia: "manual",
  },
  {
    id: "appt-sofia-followup",
    personId: "person-sofia",
    providerId: "provider-ortho",
    episodeId: "episode-sofia-arm",
    scheduledFor: "2026-08-09T15:00:00.000Z",
    status: "completed",
    reason: "Orthopedic follow-up",
    bookedVia: "manual",
  },
  {
    id: "appt-sofia-cast-removal",
    personId: "person-sofia",
    providerId: "provider-ortho",
    episodeId: "episode-sofia-arm",
    scheduledFor: "2026-09-20T15:00:00.000Z",
    status: "scheduled",
    reason: "Cast removal",
    bookedVia: "agent",
    appointmentRequestId: "req-sofia-cast-removal",
  },
  {
    id: "appt-david-checkup-past",
    personId: "person-david",
    providerId: "provider-endo",
    episodeId: "episode-david-diabetes",
    scheduledFor: "2026-06-15T13:00:00.000Z",
    status: "completed",
    reason: "Quarterly A1C check",
    bookedVia: "manual",
  },
  {
    id: "appt-david-checkup-upcoming",
    personId: "person-david",
    providerId: "provider-endo",
    episodeId: "episode-david-diabetes",
    scheduledFor: "2026-09-15T13:00:00.000Z",
    status: "scheduled",
    reason: "Quarterly A1C check",
    bookedVia: "manual",
  },
  {
    id: "appt-diego-wellness",
    personId: "person-diego",
    providerId: "provider-pediatrician",
    scheduledFor: "2026-10-01T10:00:00.000Z",
    status: "scheduled",
    reason: "Annual well-child visit",
    bookedVia: "manual",
  },
];

/**
 * One Anomaly per suggestedAction, so every action path on the bill detail
 * page (dispute, call, draft-appeal — pay_now is the one left unseeded) has
 * a real bill to demo, not just Maria's original dispute_with_payer case.
 */
export const SEED_ANOMALIES: Anomaly[] = [
  {
    id: "anomaly-maria-balance-bill",
    chargeIds: ["charge-maria-1"],
    planContextId: "plan-ramirez",
    accumulatorIds: ["accum-maria-oop"],
    type: "balance_bill",
    severity: "action_needed",
    explanation:
      "This provider billed you directly for the difference between their charge and what your plan paid. Since they're in-network, this amount likely isn't something you owe.",
    suggestedAction: "dispute_with_payer",
  },
  {
    id: "anomaly-david-coding-mismatch",
    chargeIds: ["charge-david-coding"],
    planContextId: "plan-ramirez",
    accumulatorIds: ["accum-david-oop"],
    type: "coding_mismatch",
    severity: "review",
    explanation:
      "The billing code your endocrinologist's office submitted doesn't match the visit type, which caused your insurance to underpay this claim. This is a billing office error, not something you should pay out of pocket.",
    suggestedAction: "call_provider",
  },
  {
    id: "anomaly-sofia-oon-surprise",
    chargeIds: ["charge-sofia-er-physician"],
    planContextId: "plan-ramirez",
    accumulatorIds: ["accum-sofia-oop"],
    type: "out_of_network_surprise",
    severity: "action_needed",
    explanation:
      "The physician group that treated Sofia in the ER billed this out-of-network, but federal surprise-billing protections require emergency care to be covered at in-network rates. This charge is very likely not something you owe.",
    suggestedAction: "draft_appeal_email",
  },
];

/**
 * Bill.chargeIds point at these — the line-item detail (amounts, service
 * date, CPT code, provider) that a Bills UI actually needs to render a
 * detail page, versus Bill itself which only carries status/anomaly/claim.
 */
export const SEED_CHARGES: Charge[] = [
  {
    id: "charge-maria-1",
    personId: "person-maria",
    providerId: "provider-pcp",
    serviceDate: "2026-08-20",
    cptCode: "99214",
    billedAmount: 540,
    // In-network, but the provider billed the full difference directly to
    // Maria instead of writing it off — this gap is exactly what
    // anomaly-maria-balance-bill flags as likely not owed.
    allowedAmount: 180,
  },
  {
    id: "charge-sofia-er",
    personId: "person-sofia",
    providerId: "provider-er",
    serviceDate: "2026-08-02",
    cptCode: "99284",
    billedAmount: 2570,
    // Fully allowed and paid — nothing flagged, nothing owed.
    allowedAmount: 2570,
  },
  {
    id: "charge-david-checkup",
    personId: "person-david",
    providerId: "provider-endo",
    serviceDate: "2026-06-15",
    cptCode: "83036",
    billedAmount: 320,
    // No allowedAmount yet — insurance hasn't adjudicated this claim, which
    // is exactly why bill-david-checkup's status is still "pending".
  },
  {
    id: "charge-david-coding",
    personId: "person-david",
    providerId: "provider-endo",
    serviceDate: "2026-09-01",
    cptCode: "80053",
    billedAmount: 460,
    // Underpaid because the wrong CPT code was submitted — the fix is a
    // phone call to the billing office, not a dispute with the payer.
    allowedAmount: 90,
  },
  {
    id: "charge-sofia-er-physician",
    personId: "person-sofia",
    providerId: "provider-er-attending",
    serviceDate: "2026-08-02",
    cptCode: "99285",
    billedAmount: 680,
    // Denied outright as out-of-network — the surprise-billing appeal is
    // exactly what should get this reprocessed at the in-network rate.
    allowedAmount: 0,
  },
];

/**
 * Display-name lookup for the providerIds referenced by SEED_CHARGES and
 * SEED_APPOINTMENTS/SEED_EPISODES. Not part of the shared domain model —
 * CareTeamMember records a person's regular doctor, not a per-encounter
 * provider, so this fills the gap for building a bill's display title
 * (e.g. "Bill from Riverside ER") without inventing a new domain field.
 */
export const PROVIDER_DIRECTORY: Record<string, string> = {
  "provider-pcp": "Riverside Family Medicine",
  "provider-er": "Riverside ER",
  "provider-er-attending": "Coastal Emergency Physicians",
  "provider-ortho": "Riverside Orthopedics",
  "provider-endo": "Riverside Endocrine Associates",
  "provider-pediatrician": "Riverside Family Medicine",
  // Falls back here when an appointment was requested for a care team
  // member with no matching entry in CARE_TEAM_PROVIDER_ID below (e.g. one
  // added live via the Care Team page) — avoids showing a raw internal id.
  "provider-unassigned": "Care team",
};

/**
 * CareTeamMember has no providerId of its own (it's a display-only record —
 * a person's regular doctor, not a schedulable resource id). This maps the
 * *seeded* care team members' ids to the matching providerId already used
 * for their appointments/episodes/charges, so "Request appointment" has a
 * real provider to request against. Keyed by CareTeamMember.id (not
 * personId) so a person with more than one provider — including ones added
 * live via the Care Team page, which have no entry here — resolves each
 * correctly instead of colliding; an absent entry just requests without a
 * providerId, which the mock resolves to "provider-unassigned".
 */
export const CARE_TEAM_PROVIDER_ID: Record<string, string> = {
  "careteam-maria-pcp": "provider-pcp",
  "careteam-david-endo": "provider-endo",
  "careteam-sofia-ortho": "provider-ortho",
  "careteam-diego-pcp": "provider-pediatrician",
};

export const SEED_BILLS: Bill[] = [
  {
    id: "bill-maria-1",
    personId: "person-maria",
    chargeIds: ["charge-maria-1"],
    anomalyId: "anomaly-maria-balance-bill",
    status: "flagged",
    claimId: "claim-maria-1",
  },
  {
    id: "bill-sofia-er",
    personId: "person-sofia",
    chargeIds: ["charge-sofia-er"],
    status: "paid",
  },
  {
    id: "bill-david-checkup",
    personId: "person-david",
    chargeIds: ["charge-david-checkup"],
    status: "pending",
  },
  {
    id: "bill-david-coding",
    personId: "person-david",
    chargeIds: ["charge-david-coding"],
    anomalyId: "anomaly-david-coding-mismatch",
    status: "flagged",
    claimId: "claim-david-coding",
  },
  {
    id: "bill-sofia-er-physician",
    personId: "person-sofia",
    chargeIds: ["charge-sofia-er-physician"],
    anomalyId: "anomaly-sofia-oon-surprise",
    status: "flagged",
    claimId: "claim-sofia-er-physician",
  },
];

export const SEED_DOCUMENTS: WestyDocument[] = [
  {
    id: "doc-sofia-er-summary",
    personId: "person-sofia",
    episodeId: "episode-sofia-arm",
    type: "eob",
    status: "extracted",
    extracted: { diagnosis: "Distal radius fracture, left arm", facility: "Riverside ER" },
    explanation:
      "This is the ER discharge summary from Sofia's visit on August 2nd — it confirms the fracture diagnosis and the initial splint placement.",
  },
  {
    id: "doc-sofia-xray",
    personId: "person-sofia",
    episodeId: "episode-sofia-arm",
    type: "other",
    status: "extracted",
    extracted: { facility: "Riverside Orthopedics" },
  },
  {
    id: "doc-david-labs",
    personId: "person-david",
    episodeId: "episode-david-diabetes",
    type: "other",
    status: "processing",
  },
];

export const SEED_CARE_TEAM: CareTeamMember[] = [
  {
    id: "careteam-maria-pcp",
    personId: "person-maria",
    name: "Dr. Elena Ortiz",
    role: "Primary Care Physician",
    organization: "Riverside Family Medicine",
    phone: "555-0101",
    email: "contact@riversidefamilymed.example",
    website: "https://riversidefamilymed.example",
    address: "100 Riverside Ave, Springfield, ST 00001",
  },
  {
    id: "careteam-david-endo",
    personId: "person-david",
    name: "Dr. Priya Shah",
    role: "Endocrinologist",
    organization: "Riverside Endocrine Associates",
    phone: "555-0142",
    email: "info@riversideendocrine.example",
    website: "https://riversideendocrine.example",
    address: "220 Riverside Ave, Springfield, ST 00001",
  },
  {
    id: "careteam-sofia-ortho",
    personId: "person-sofia",
    name: "Dr. Marcus Webb",
    role: "Orthopedist",
    organization: "Riverside Orthopedics",
    phone: "555-0177",
    email: "info@riversideortho.example",
    website: "https://riversideortho.example",
    address: "340 Riverside Ave, Springfield, ST 00001",
  },
  {
    id: "careteam-diego-pcp",
    personId: "person-diego",
    name: "Dr. Elena Ortiz",
    role: "Pediatrician",
    organization: "Riverside Family Medicine",
    phone: "555-0101",
    email: "contact@riversidefamilymed.example",
    website: "https://riversidefamilymed.example",
    address: "100 Riverside Ave, Springfield, ST 00001",
  },
];

/**
 * Maria and David's connectors are pre-connected — the demo doesn't need
 * to script every connection, only the one that matters for the failure
 * moment. Diego's pediatrician connector is intentionally ABSENT from this
 * seed — it's created live, in "pending" status, when the rep clicks
 * Connect during the demo (see MockWestyClient.initiateConnector).
 */
export const SEED_CONNECTORS: Connector[] = [
  {
    id: "connector-maria-payer",
    ownerPersonId: "person-maria",
    type: "payer",
    vendor: "Riverside Health Plan",
    status: "connected",
    credentialRef: "vault-ref-1",
    lastSyncedAt: "2026-09-10T08:00:00.000Z",
  },
  {
    id: "connector-david-hsa",
    ownerPersonId: "person-david",
    type: "hsa_fsa_card",
    vendor: "HealthEquity",
    status: "connected",
    credentialRef: "vault-ref-2",
    lastSyncedAt: "2026-09-10T08:00:00.000Z",
  },
];

export const SEED_TASKS: Task[] = [
  {
    id: "task-sofia-followup",
    personId: "person-sofia",
    title: "Confirm cast removal appointment",
    status: "open",
    source: "system",
    episodeId: "episode-sofia-arm",
    due: "2026-09-18",
  },
  {
    id: "task-maria-dispute",
    personId: "person-maria",
    title: "Review and respond to flagged bill",
    status: "open",
    source: "bill",
  },
];

export const SEED_CHAT_THREAD: ChatThread = {
  id: "chat-maria",
  personId: "person-maria",
  messages: [
    {
      id: "msg-1",
      role: "user",
      text: "Why was I billed for Sofia's ER visit if we already met our deductible?",
      isAiGenerated: false,
    },
    {
      id: "msg-2",
      role: "assistant",
      text: "Looking at your plan, your family deductible was met on July 28th — before this visit. This charge looks like a balance bill from an in-network provider, which usually isn't something you owe. I've flagged it on your Bills page with a suggested next step.",
      isAiGenerated: true,
      groundedInDocumentIds: ["doc-sofia-er-summary"],
    },
  ],
};

/** Bundles every seed array so MockWestyClient can deep-clone it all at once. */
export function getSeedData() {
  return {
    user: SEED_USER,
    household: SEED_HOUSEHOLD,
    people: SEED_PEOPLE,
    episodes: SEED_EPISODES,
    episodeSuggestions: SEED_EPISODE_SUGGESTIONS,
    appointments: SEED_APPOINTMENTS,
    anomalies: SEED_ANOMALIES,
    charges: SEED_CHARGES,
    bills: SEED_BILLS,
    documents: SEED_DOCUMENTS,
    careTeam: SEED_CARE_TEAM,
    connectors: SEED_CONNECTORS,
    tasks: SEED_TASKS,
    chatThread: SEED_CHAT_THREAD,
  };
}
