"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockWestyClient } from "@/lib/mock";

/**
 * The initials square in the design's nav bar (e.g. "MJ") isn't just
 * decoration there — it's the entry point to account-level actions that
 * don't belong in the fixed nav-link set. We use it the same way here,
 * linking to /settings instead of adding a standalone "Settings" nav link.
 */
export function UserAvatar() {
  const [initials, setInitials] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const person = await mockWestyClient.getPerson(user.personId);
      if (cancelled) return;
      setInitials(`${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/settings"
      title="Settings"
      style={{
        width: 32,
        height: 32,
        background: "var(--color-neutral-800)",
        color: "var(--color-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 12,
        textDecoration: "none",
      }}
    >
      {initials}
    </Link>
  );
}
