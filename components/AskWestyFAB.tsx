"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "/" and "/onboarding" per the task; "/ask-westy" too — the FAB only
// exists to jump to that page, so showing it there would just be a
// self-referential "click to go here" link.
const HIDDEN_ROUTES = ["/", "/onboarding", "/ask-westy"];

/**
 * The simple, persistent FAB that appears in 7 of the 11 design files
 * (Dashboard, Bills, BillDetail, Household, Connectors, Episode,
 * Appointments) — just an icon linking to /ask-westy. The design's own
 * Westy-AskWesty.dc.html also shows a richer inline chat overlay, but that
 * only exists there as aspirational documentation ("Floating overlay —
 * available from every screen in the app") and was never actually built out
 * in any other design file. Building that richer version is a deliberate
 * future decision, not this component's job.
 */
export function AskWestyFAB() {
  const pathname = usePathname();
  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <Link
      href="/ask-westy"
      title="Ask Westy"
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        width: 52,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-accent)",
        color: "var(--color-bg)",
        textDecoration: "none",
        boxShadow: "var(--shadow-lg)",
        zIndex: 20,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
    </Link>
  );
}
