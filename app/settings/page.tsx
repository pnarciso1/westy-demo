"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { mockWestyClient } from "@/lib/mock";
import { Card, CardTitle, CardBody, Button, Dialog, Field, TextInput, SectionLabel } from "@westy/shared/ui";

export default function Settings() {
  const router = useRouter();
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleLogout() {
    router.push("/");
  }

  function handleConfirmReset() {
    mockWestyClient.resetDemo();
    setConfirmingReset(false);
    router.push("/");
  }

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Appointments", href: "/appointments" },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
        trailing={<UserAvatar />}
      />

      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>Settings</h1>
            <p className="text-muted" style={{ fontSize: 14 }}>
              Account, security, and billing.
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </div>

        <section>
          <SectionLabel>Security</SectionLabel>
          <Card>
            <CardTitle>Password</CardTitle>
            <CardBody>
              This is a demo account with no real authentication behind it, so password
              changes aren&apos;t available.
            </CardBody>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <Field label="New password" htmlFor="new-password">
                <TextInput id="new-password" type="password" disabled placeholder="Not available in this demo" />
              </Field>
              <Button variant="secondary" disabled style={{ alignSelf: "flex-start" }}>
                Change password
              </Button>
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel>Billing</SectionLabel>
          <Card>
            <CardTitle>Westy Family Plan</CardTitle>
            <CardBody>
              This is placeholder billing information — nothing in the domain model
              represents a subscription or payment method yet.
            </CardBody>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "var(--space-3)", fontSize: 13 }}>
              <div>
                <strong>Plan:</strong> Family (up to 6 members)
              </div>
              <div>
                <strong>Payment method:</strong> Visa ending in 4242
              </div>
              <div>
                <strong>Next billing date:</strong> —
              </div>
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel>Demo tools</SectionLabel>
          <div
            style={{
              background: "var(--color-accent-100)",
              border: "1px solid var(--color-accent-300)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Reset demo data</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.75 }}>
                Wipes every in-progress change (disputed bills, added connectors, booked
                appointments, everything) back to the seeded Ramirez household, then
                returns you to the homepage to restart from Get Started.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setConfirmingReset(true)} style={{ alignSelf: "flex-start" }}>
              Reset demo data
            </Button>
          </div>
        </section>
      </main>

      <Dialog
        open={confirmingReset}
        title="Reset demo data?"
        onDismiss={() => setConfirmingReset(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmReset}>
              Reset
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          This permanently wipes all in-progress demo state and can&apos;t be undone. You&apos;ll
          be returned to the homepage.
        </p>
      </Dialog>
    </>
  );
}
