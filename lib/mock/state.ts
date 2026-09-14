import type {
  OnboardingSession,
  AppointmentRequest,
  PersonalDataExport,
  ChatThread,
} from "@westy/shared";
import { getSeedData } from "./seed";

/**
 * Everything the mock client can mutate during a demo session. Seeded
 * arrays are deep-cloned from seed.ts on init and on reset; the four maps
 * hold things that don't exist until a demo action creates them
 * (onboarding sessions, appointment requests, exports, and per-person chat
 * threads beyond the one pre-seeded for Maria).
 */
export interface MockState {
  user: ReturnType<typeof getSeedData>["user"];
  household: ReturnType<typeof getSeedData>["household"];
  people: ReturnType<typeof getSeedData>["people"];
  episodes: ReturnType<typeof getSeedData>["episodes"];
  episodeSuggestions: ReturnType<typeof getSeedData>["episodeSuggestions"];
  appointments: ReturnType<typeof getSeedData>["appointments"];
  anomalies: ReturnType<typeof getSeedData>["anomalies"];
  bills: ReturnType<typeof getSeedData>["bills"];
  documents: ReturnType<typeof getSeedData>["documents"];
  careTeam: ReturnType<typeof getSeedData>["careTeam"];
  connectors: ReturnType<typeof getSeedData>["connectors"];
  availableConnectors: ReturnType<typeof getSeedData>["availableConnectors"];
  tasks: ReturnType<typeof getSeedData>["tasks"];
  onboardingSessions: Map<string, OnboardingSession>;
  appointmentRequests: Map<string, AppointmentRequest>;
  dataExports: Map<string, PersonalDataExport>;
  chatThreads: Map<string, ChatThread>;
  /** Simple counter for generating new ids during a demo session */
  nextId: number;
}

export function createInitialState(): MockState {
  const seed = getSeedData();
  return {
    user: structuredClone(seed.user),
    household: structuredClone(seed.household),
    people: structuredClone(seed.people),
    episodes: structuredClone(seed.episodes),
    episodeSuggestions: structuredClone(seed.episodeSuggestions),
    appointments: structuredClone(seed.appointments),
    anomalies: structuredClone(seed.anomalies),
    bills: structuredClone(seed.bills),
    documents: structuredClone(seed.documents),
    careTeam: structuredClone(seed.careTeam),
    connectors: structuredClone(seed.connectors),
    availableConnectors: structuredClone(seed.availableConnectors),
    tasks: structuredClone(seed.tasks),
    onboardingSessions: new Map(),
    appointmentRequests: new Map(),
    dataExports: new Map(),
    chatThreads: new Map([[seed.chatThread.personId, structuredClone(seed.chatThread)]]),
    nextId: 1,
  };
}
