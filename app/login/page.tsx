"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar, Card, CardTitle, Button, Field, TextInput } from "@westy/shared/ui";

// No real auth exists anywhere in this demo (see MockWestyClient.getCurrentUser,
// which always returns the seeded Maria Ramirez user regardless of input) —
// submitting here is a straight navigation to /dashboard, same as the old
// direct "Log in" link, just with a screen in between instead of an
// invisible jump.
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <>
      <NavBar brand="Westy" links={[]} />

      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 420,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Log in</h1>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Welcome back to Westy.
          </p>
        </div>

        <Card>
          <CardTitle>Sign in to your account</CardTitle>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <TextInput
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button variant="primary" type="submit">
              Log in
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
