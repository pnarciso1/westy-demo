"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { Tag, Skeleton, SectionLabel } from "@westy/shared/ui";
import type { Appointment, Person } from "@westy/shared";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";

type Row = { appointment: Appointment; member: Person };

function DateBox({ iso, dimmed }: { iso: string; dimmed?: boolean }) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(date);
  return (
    <div style={{ width: 52, flex: "none" }}>
      <div style={{ fontSize: 11, opacity: 0.55 }}>{month}</div>
      <div style={{ fontSize: 20, fontWeight: 800, opacity: dimmed ? 0.6 : 1 }}>{day}</div>
    </div>
  );
}

function statusTag(appointment: Appointment) {
  if (appointment.status === "scheduled") {
    return appointment.bookedVia === "agent" ? (
      <Tag variant="outline">Booked by Westy</Tag>
    ) : (
      <Tag variant="neutral">Scheduled</Tag>
    );
  }
  if (appointment.status === "cancelled") return <Tag variant="outline">Cancelled</Tag>;
  if (appointment.status === "no_show") return <Tag variant="accent">No-show</Tag>;
  return <Tag variant="neutral">Completed</Tag>;
}

function AppointmentRow({ row }: { row: Row }) {
  const { appointment, member } = row;
  const isPast = appointment.status !== "scheduled";
  const providerName = PROVIDER_DIRECTORY[appointment.providerId] ?? appointment.providerId;
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(appointment.scheduledFor)
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        padding: "14px 0",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <DateBox iso={appointment.scheduledFor} dimmed={isPast} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{appointment.reason ?? "Appointment"}</div>
        <div style={{ fontSize: 12, opacity: 0.55 }}>
          {member.firstName} {member.lastName} · {providerName}
          {appointment.status === "scheduled" && ` · ${time}`}
        </div>
      </div>
      {isPast && appointment.episodeId ? (
        <Link href={`/episodes/${appointment.episodeId}`} style={{ fontSize: 12, textDecoration: "none" }}>
          View episode →
        </Link>
      ) : (
        statusTag(appointment)
      )}
    </div>
  );
}

export default function Appointments() {
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [past, setPast] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const me = await mockWestyClient.getPerson(user.personId);
      const members = await mockWestyClient.listHouseholdMembers(me.householdId);
      const perMember = await Promise.all(
        members.map(async (member) => ({
          member,
          appointments: await mockWestyClient.listAppointments(member.id),
        }))
      );

      const upcomingRows: Row[] = [];
      const pastRows: Row[] = [];
      for (const { member, appointments } of perMember) {
        for (const appointment of appointments) {
          const row = { appointment, member };
          if (appointment.status === "scheduled") upcomingRows.push(row);
          else pastRows.push(row);
        }
      }
      upcomingRows.sort((a, b) => a.appointment.scheduledFor.localeCompare(b.appointment.scheduledFor));
      pastRows.sort((a, b) => b.appointment.scheduledFor.localeCompare(a.appointment.scheduledFor));

      setUpcoming(upcomingRows);
      setPast(pastRows);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Appointments", href: "/appointments", active: true },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
        trailing={<UserAvatar />}
      />

      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 900,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Appointments</h1>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Everyone&apos;s visits, past and upcoming, in one list.
          </p>
        </div>

        {loading ? (
          <>
            <Skeleton height={60} />
            <Skeleton height={60} />
            <Skeleton height={60} />
          </>
        ) : (
          <>
            <section>
              <SectionLabel>Upcoming</SectionLabel>
              {upcoming.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Nothing scheduled yet.
                </p>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {upcoming.map((row) => (
                    <AppointmentRow key={row.appointment.id} row={row} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel>Past</SectionLabel>
              {past.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  No past appointments yet.
                </p>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {past.map((row) => (
                    <AppointmentRow key={row.appointment.id} row={row} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
