"use client";

import { useRouter } from "next/navigation";
import {
  NavBar,
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Button,
  AiSurface,
  SectionLabel,
} from "@westy/shared/ui";

const STEPS = [
  {
    number: "01",
    title: "Understand coverage",
    body: "Westy explains your plan and benefits in plain language, not insurance-speak.",
  },
  {
    number: "02",
    title: "Use what you're entitled to",
    body: "Track HSA/FSA balances and benefit deadlines before they expire.",
  },
  {
    number: "03",
    title: "Pay with confidence",
    body: "Westy catches billing errors and tells you exactly what you actually owe.",
  },
];

// Mirrors lib/mock/seed.ts's Ramirez household, so this preview matches what
// onboarding and the Dashboard actually show later.
const HOUSEHOLD_PREVIEW = [
  { name: "Maria Ramirez", role: "Coordinator" },
  { name: "David Ramirez", role: "Spouse" },
  { name: "Sofia Ramirez", role: "Child" },
  { name: "Diego Ramirez-Nunez", role: "Child" },
];

export default function Home() {
  const router = useRouter();

  function scrollToHowItWorks() {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <NavBar
        brand="Westy"
        links={[
          { label: "How it works", href: "#how-it-works" },
          { label: "Log in", href: "/dashboard" },
        ]}
        trailing={
          <Button variant="primary" onClick={() => router.push("/onboarding")}>
            Get started
          </Button>
        }
      />

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-8)",
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxWidth: 640 }}>
          <SectionLabel>For the person who keeps it all straight</SectionLabel>
          <h1>One place to understand, use, and pay for your family&apos;s healthcare.</h1>
          <p>
            Westy pulls together every bill, benefit, and provider for your household —
            explains what your coverage actually means, helps you use what you&apos;re
            entitled to before it expires, and tells you, in plain language, when
            something needs your attention.
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => router.push("/onboarding")}>
              Get started free
            </Button>
            <Button variant="secondary" onClick={scrollToHowItWorks}>
              See how it works
            </Button>
          </div>
          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
            Free to start. Live in about 5 minutes.
          </p>
        </section>

        <figure style={{ margin: 0, maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <AiSurface>
            Your family still has $850 in FSA funds and 46 days left to use them — want
            me to suggest ways to use it before it expires?
          </AiSurface>
          <AiSurface>
            Sofia&apos;s ER bill looks off — your insurance paid less than your plan says
            it should have. Want me to draft an appeal?
          </AiSurface>
          <figcaption>
            This is what Westy sounds like everywhere in the app — and you&apos;ll always
            know it&apos;s Westy talking, not your data.
          </figcaption>
        </figure>

        <section id="how-it-works" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SectionLabel>How Westy helps, step by step</SectionLabel>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {STEPS.map((step) => (
              <Card key={step.number} style={{ flex: "1 1 200px", minWidth: 200 }}>
                <CardKicker>{step.number}</CardKicker>
                <CardTitle>{step.title}</CardTitle>
                <CardBody>{step.body}</CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SectionLabel>Everyone in your household, in one view</SectionLabel>
          <p style={{ maxWidth: 560, margin: 0 }}>
            Every family member gets their own profile — separate records, appointments,
            and bills — all visible together in one shared household view.
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {HOUSEHOLD_PREVIEW.map((member) => (
              <Card key={member.name} style={{ flex: "1 1 180px", minWidth: 180 }}>
                <CardTitle>{member.name}</CardTitle>
                <CardMeta>{member.role}</CardMeta>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <section
        style={{
          background: "var(--color-text)",
          color: "var(--color-bg)",
          padding: "var(--space-8) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          textAlign: "center",
        }}
      >
        <h2 style={{ maxWidth: 640, margin: 0 }}>
          Stop juggling folders, portals, and phone calls. Let Westy hold the whole
          picture.
        </h2>
        <Button variant="primary" onClick={() => router.push("/onboarding")}>
          Get started free
        </Button>
      </section>

      <footer style={{ borderTop: "2px solid var(--color-divider)", padding: "var(--space-4)", textAlign: "center" }}>
        <span className="text-muted" style={{ fontSize: 12 }}>
          © 2026 Westy. Not a substitute for medical or insurance advice.
        </span>
      </footer>
    </>
  );
}
