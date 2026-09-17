"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Tag, Button, Skeleton, SectionLabel } from "@westy/shared/ui";
import type { Appointment, Document as WestyDocument, Episode, Person, Task } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";
import { formatShortDate } from "@/lib/bills";
import { DOC_TYPE_LABEL, DOC_SOURCE_LABEL, DocumentStatusTag } from "@/lib/documents";

export default function EpisodeDetail() {
  const params = useParams<{ id: string }>();
  const episodeId = params.id;

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [documents, setDocuments] = useState<WestyDocument[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  async function loadEpisode() {
    const ep = await mockWestyClient.getEpisode(episodeId);
    const [personRecord, allAppointments, allDocuments, allTasks] = await Promise.all([
      mockWestyClient.getPerson(ep.personId),
      mockWestyClient.listAppointments(ep.personId),
      mockWestyClient.listDocuments(ep.personId),
      mockWestyClient.listTasks(ep.personId),
    ]);
    setEpisode(ep);
    setPerson(personRecord);
    setAppointments(
      allAppointments
        .filter((a) => ep.appointmentIds.includes(a.id))
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    );
    setDocuments(allDocuments.filter((d) => ep.documentIds.includes(d.id)));
    setTasks(allTasks.filter((t) => ep.taskIds.includes(t.id)));
  }

  useEffect(() => {
    loadEpisode();
  }, [episodeId]);

  async function handleCompleteTask(taskId: string) {
    await mockWestyClient.completeTask(taskId);
    await loadEpisode();
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
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <Link
          href="/household"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}
        >
          ← My Household
        </Link>

        {!episode || !person ? (
          <>
            <Skeleton height={20} width={200} />
            <Skeleton height={32} width="50%" />
            <Skeleton height={200} />
          </>
        ) : (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-accent-700)",
                  }}
                >
                  {person.firstName} {person.lastName} · Episode
                </div>
                {episode.status === "active" ? (
                  <Tag variant="outline">Active</Tag>
                ) : (
                  <Tag variant="neutral">Closed</Tag>
                )}
              </div>
              <h1 style={{ fontSize: 28, marginBottom: 6 }}>{episode.title}</h1>
              <p className="text-muted" style={{ fontSize: 14, marginBottom: 8 }}>
                {formatShortDate(episode.startedOn)} —{" "}
                {episode.status === "closed" && episode.closedOn ? `closed ${formatShortDate(episode.closedOn)}` : "ongoing"}
              </p>
              {episode.totalCost !== undefined && (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Total cost this episode: ${episode.totalCost.toLocaleString("en-US")}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-8)" }}>
              <section>
                <h3 style={{ margin: "0 0 20px" }}>Timeline</h3>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {appointments.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      No appointments on file for this episode.
                    </p>
                  )}
                  {appointments.map((appt, i) => {
                    const isLast = i === appointments.length - 1;
                    const isUpcoming = appt.status === "scheduled";
                    const providerName = PROVIDER_DIRECTORY[appt.providerId] ?? appt.providerId;
                    return (
                      <div key={appt.id} style={{ display: "flex", gap: 16, position: "relative", paddingBottom: 24 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            marginTop: 5,
                            flex: "none",
                            background: isUpcoming ? "var(--color-bg)" : "var(--color-text)",
                            border: isUpcoming ? "2px solid var(--color-text)" : "none",
                          }}
                        />
                        {!isLast && (
                          <div
                            style={{
                              borderLeft: "2px solid var(--color-divider)",
                              position: "absolute",
                              left: 4,
                              top: 16,
                              bottom: 0,
                            }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.55 }}>{formatShortDate(appt.scheduledFor)}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, opacity: isUpcoming ? 0.6 : 1 }}>
                            {appt.reason ?? "Appointment"} — {providerName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <SectionLabel>Linked documents</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
                  {documents.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      No documents linked to this episode.
                    </p>
                  )}
                  {documents.map((doc) => (
                    <Card key={doc.id} style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{DOC_TYPE_LABEL[doc.type]}</div>
                        <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{DOC_SOURCE_LABEL}</div>
                      </div>
                      <DocumentStatusTag status={doc.status} />
                    </Card>
                  ))}
                </div>

                <SectionLabel>Linked tasks</SectionLabel>
                <div>
                  {tasks.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      No tasks linked to this episode.
                    </p>
                  )}
                  {tasks.map((task) => {
                    const isDone = task.status === "complete";
                    const isBillTask = task.source === "bill";
                    return (
                      <div
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 0",
                          borderBottom: "1px solid var(--color-divider)",
                          opacity: isDone ? 0.55 : 1,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            flex: "none",
                            border: isDone ? "none" : "1.5px solid var(--color-divider)",
                            background: isDone ? "var(--color-text)" : "transparent",
                            color: "var(--color-bg)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isDone && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, textDecoration: isDone ? "line-through" : "none" }}>
                          {task.title}
                        </div>
                        {isDone ? (
                          <Tag variant="neutral">Done</Tag>
                        ) : (
                          <>
                            <Tag variant={isBillTask ? "accent" : "outline"}>
                              {isBillTask ? "Needs attention" : "In progress"}
                            </Tag>
                            <Button variant="ghost" onClick={() => handleCompleteTask(task.id)}>
                              Mark complete
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
