import type { Document as WestyDocument } from "@westy/shared";
import { Tag } from "@westy/shared/ui";

export const DOC_TYPE_LABEL: Record<WestyDocument["type"], string> = {
  insurance_summary: "Insurance Benefit Summary",
  eob: "EOB",
  provider_bill: "Provider Bill",
  other: "Document",
};

const DOC_STATUS_TAG: Record<WestyDocument["status"], { variant: "neutral" | "outline" | "accent"; label: string }> = {
  uploaded: { variant: "outline", label: "Uploaded" },
  processing: { variant: "outline", label: "Processing…" },
  extracted: { variant: "neutral", label: "Extracted" },
  failed: { variant: "accent", label: "Failed" },
};

// Every Document in this system arrives the same way — WestyClient has a
// single ingestion path, uploadDocument — so there's no real "synced from a
// connector" or "entered manually" case to distinguish yet. Showing that
// variety would mean fabricating a distinction the domain model doesn't
// make; this is honestly the only source label today.
export const DOC_SOURCE_LABEL = "↳ Extracted from your upload";

export function DocumentStatusTag({ status }: { status: WestyDocument["status"] }) {
  const { variant, label } = DOC_STATUS_TAG[status];
  return <Tag variant={variant}>{label}</Tag>;
}
