import type { Anomaly, Bill, Charge } from "@westy/shared";
import { Tag } from "@westy/shared/ui";

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatShortDate(iso: string): string {
  // Date-only ISO strings ("2026-08-20") parse as UTC midnight — format in
  // UTC too, or the viewer's local timezone can shift the displayed day back.
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

/**
 * Bill itself carries no dollar amounts — only its Charges do. Insurance
 * hasn't adjudicated a charge until it has an allowedAmount, which is
 * exactly what "pending" means, so `insurancePaid` stays null until then
 * and the full billed amount is what's currently owed.
 */
export function billFinancials(charges: Charge[]): { billed: number; insurancePaid: number | null; owe: number } {
  const billed = charges.reduce((sum, c) => sum + c.billedAmount, 0);
  const allAdjudicated = charges.every((c) => c.allowedAmount !== undefined);
  if (!allAdjudicated) {
    return { billed, insurancePaid: null, owe: billed };
  }
  const insurancePaid = charges.reduce((sum, c) => sum + (c.allowedAmount ?? 0), 0);
  return { billed, insurancePaid, owe: billed - insurancePaid };
}

export function billTitle(charges: Charge[], providerDirectory: Record<string, string>): string {
  const providerId = charges[0]?.providerId;
  const providerName = providerId ? providerDirectory[providerId] ?? providerId : "Unknown provider";
  return `Bill from ${providerName}`;
}

/**
 * The regulatory/policy citation and the specific corrective ask for each
 * Anomaly.type — this is what lets an appeal letter argue something more
 * substantive than "please reprocess this." Keyed by type (not
 * suggestedAction) so the same reasoning applies no matter which action an
 * anomaly happens to suggest.
 */
const APPEAL_ARGUMENTS: Record<Anomaly["type"], { citation: string; ask: string }> = {
  balance_bill: {
    citation:
      "In-network providers are required to accept the plan's allowed amount as payment in full and may not bill patients for the difference.",
    ask: "waive the balance-billed amount and limit my responsibility to my plan's normal in-network cost-share",
  },
  out_of_network_surprise: {
    citation:
      "Under the federal No Surprises Act, emergency care must be covered at in-network cost-sharing rates regardless of the treating provider's network status.",
    ask: "reprocess this claim at in-network rates and adjust my patient responsibility accordingly",
  },
  duplicate_charge: {
    citation: "This service appears to have been billed more than once for the same encounter.",
    ask: "remove the duplicate charge and reprocess this claim for the single service actually rendered",
  },
  coding_mismatch: {
    citation: "The procedure code submitted does not match the service documented for this visit.",
    ask: "correct the billing code and reprocess this claim under the accurate code",
  },
  other: {
    citation: "This charge does not appear to be consistent with my plan's benefits.",
    ask: "review and correct this charge in line with my plan's benefit terms",
  },
};

/**
 * A complete appeal letter — opening, body, closing, and signature — built
 * from the anomaly's own type/explanation and the bill's real numbers, so
 * it's never generic boilerplate disconnected from why the bill was
 * flagged. Works for any Anomaly.type, not just the one bill that currently
 * uses draft_appeal_email as its suggestedAction.
 */
export function draftAppealLetter(params: {
  coordinatorName: string;
  patientName: string;
  providerName: string;
  serviceDate: string;
  billedAmount: number;
  owe: number;
  anomaly: Anomaly;
}): string {
  const { citation, ask } = APPEAL_ARGUMENTS[params.anomaly.type];
  return [
    "To Whom It May Concern:",
    "",
    `I am writing on behalf of ${params.patientName} to appeal the billing for the ${formatLongDate(
      params.serviceDate
    )} visit with ${params.providerName}, currently billed at ${formatMoney(
      params.billedAmount
    )} with a patient responsibility of ${formatMoney(params.owe)}.`,
    "",
    `${params.anomaly.explanation} ${citation}`,
    "",
    `I am requesting that you ${ask}.`,
    "",
    "Please let me know if you need any additional information to process this appeal.",
    "",
    "Sincerely,",
    params.coordinatorName,
  ].join("\n");
}

/**
 * A bill with no Anomaly still deserves a plain-language explanation, not
 * just a status tag — this covers the statuses an Anomaly-less bill can
 * actually be in (Anomaly.explanation is used instead whenever one exists).
 */
export function fallbackExplanation(
  bill: Bill,
  financials: { billed: number; insurancePaid: number | null; owe: number }
): string {
  switch (bill.status) {
    case "pending":
      return "This bill is still waiting on your insurance to process. Once they've adjudicated the claim, I'll update what's covered and what you owe.";
    case "paid":
      return `This bill was paid in full — insurance covered ${formatMoney(
        financials.insurancePaid ?? financials.billed
      )} and nothing further is owed.`;
    case "disputed":
      return "An appeal or dispute is in progress for this bill.";
    case "flagged":
      return "I flagged this bill for a closer look.";
  }
}

const ICON_PROPS = {
  width: 10,
  height: 10,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { marginRight: 3 },
};

function ClockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v18" />
      <path d="M3 7l4-2 4 2-4 9-4-9Z" />
      <path d="M13 7l4-2 4 2-4 9-4-9Z" />
      <path d="M5 21h14" />
    </svg>
  );
}

/** Status → Tag mapping as shown in Westy-Bills.dc.html's list table. */
export function BillsListStatusTag({ status }: { status: Bill["status"] }) {
  switch (status) {
    case "pending":
      return (
        <Tag variant="neutral">
          <ClockIcon />
          Pending
        </Tag>
      );
    case "flagged":
      return (
        <Tag variant="accent">
          <FlagIcon />
          Flagged
        </Tag>
      );
    case "paid":
      return (
        <Tag variant="neutral">
          <CheckIcon />
          Paid
        </Tag>
      );
    case "disputed":
      return (
        <Tag variant="outline">
          <ScaleIcon />
          Disputed
        </Tag>
      );
  }
}

/**
 * Status → Tag mapping as shown in Westy-BillDetail.dc.html's header — a
 * different variant per status than the list page uses for the same
 * statuses (outline for flagged, accent for disputed). Kept as its own
 * mapping rather than unified with the list page's, since that's what each
 * design file literally shows.
 */
export function BillDetailStatusTag({ status }: { status: Bill["status"] }) {
  switch (status) {
    case "pending":
      return (
        <Tag variant="neutral">
          <ClockIcon />
          Pending
        </Tag>
      );
    case "flagged":
      return (
        <Tag variant="outline">
          <FlagIcon />
          Flagged
        </Tag>
      );
    case "paid":
      return (
        <Tag variant="neutral">
          <CheckIcon />
          Paid
        </Tag>
      );
    case "disputed":
      return (
        <Tag variant="accent">
          <ScaleIcon />
          Disputed
        </Tag>
      );
  }
}
