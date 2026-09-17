"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  Card,
  CardKicker,
  CardTitle,
  CardBody,
  CardMeta,
  Tag,
  Button,
  Skeleton,
  SectionLabel,
  AiSurface,
} from "@westy/shared/ui";
import type { Anomaly, Appointment, Bill, Person, Task } from "@westy/shared";
import { mockWestyClient, PROVIDER_DIRECTORY } from "@/lib/mock";
import { billFinancials, billTitle, formatMoney, formatShortDate } from "@/lib/bills";
import type { DashboardSummary } from "@westy/shared/client";

type FlaggedDetail = {
  bill: Bill;
  title: string;
  member: Person | undefined;
  anomaly: Anomaly | null;
  owe: number;
};

type UpcomingAppointment = { appointment: Appointment; member: Person };

const MEMBER_SPEND_COLORS = ["var(--color-accent-700)", "var(--color-accent-500)", "var(--color-accent-300)", "var(--color-neutral-400)"];

export default function Dashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [coordinatorFirstName, setCoordinatorFirstName] = useState("");
  const [householdLastName, setHouseholdLastName] = useState("");
  const [flaggedDetails, setFlaggedDetails] = useState<FlaggedDetail[]>([]);
  const [openBillsOwed, setOpenBillsOwed] = useState(0);
  const [totalHouseholdSpend, setTotalHouseholdSpend] = useState(0);
  const [memberSpend, setMemberSpend] = useState<{ member: Person; spend: number }[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  async function loadDashboard() {
    const user = await mockWestyClient.getCurrentUser();
    const data = await mockWestyClient.getDashboard(user.personId);
    setSummary(data);

    const me = data.members.find((m) => m.id === user.personId) ?? (await mockWestyClient.getPerson(user.personId));
    setCoordinatorFirstName(me.firstName);
    setHouseholdLastName(me.lastName);

    const flagged = await Promise.all(
      data.flaggedBills.map(async (bill) => {
        const charges = await mockWestyClient.getCharges(bill.chargeIds);
        const anomaly = bill.anomalyId ? await mockWestyClient.getAnomaly(bill.anomalyId) : null;
        const member = data.members.find((m) => m.id === bill.personId);
        return { bill, title: billTitle(charges, PROVIDER_DIRECTORY), member, anomaly, owe: billFinancials(charges).owe };
      })
    );
    setFlaggedDetails(flagged);

    const perMember = await Promise.all(
      data.members.map(async (member) => {
        const [bills, tasks, appointments] = await Promise.all([
          mockWestyClient.listBills(member.id),
          mockWestyClient.listTasks(member.id),
          mockWestyClient.listAppointments(member.id),
        ]);
        const billsWithCharges = await Promise.all(
          bills.map(async (bill) => ({ bill, charges: await mockWestyClient.getCharges(bill.chargeIds) }))
        );
        return { member, billsWithCharges, tasks, appointments };
      })
    );

    let openOwed = 0;
    let totalSpend = 0;
    const tasks: Task[] = [];
    const appts: UpcomingAppointment[] = [];
    const spendByMember: { member: Person; spend: number }[] = [];
    for (const { member, billsWithCharges, tasks: memberTasks, appointments } of perMember) {
      let memberTotal = 0;
      for (const { bill, charges } of billsWithCharges) {
        const fin = billFinancials(charges);
        memberTotal += fin.billed;
        if (bill.status !== "paid") openOwed += fin.owe;
      }
      totalSpend += memberTotal;
      spendByMember.push({ member, spend: memberTotal });
      tasks.push(...memberTasks);
      for (const appointment of appointments) {
        if (appointment.status === "scheduled") appts.push({ appointment, member });
      }
    }
    setOpenBillsOwed(openOwed);
    setTotalHouseholdSpend(totalSpend);
    setMemberSpend(spendByMember);
    setAllTasks(tasks);
    setUpcomingAppointments(appts.sort((a, b) => a.appointment.scheduledFor.localeCompare(b.appointment.scheduledFor)));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleAcceptSuggestion(suggestionId: string) {
    await mockWestyClient.acceptEpisodeSuggestion(suggestionId);
    await loadDashboard();
  }

  async function handleDismissSuggestion(suggestionId: string) {
    await mockWestyClient.dismissEpisodeSuggestion(suggestionId);
    await loadDashboard();
  }

  async function handleCompleteTask(taskId: string) {
    await mockWestyClient.completeTask(taskId);
    await loadDashboard();
  }

  const openTasks = allTasks.filter((t) => t.status === "open");
  const completedTasks = allTasks.filter((t) => t.status === "complete");
  const openBillsPct = totalHouseholdSpend > 0 ? Math.min(100, Math.round((openBillsOwed / totalHouseholdSpend) * 100)) : 0;
  const primaryAnomalyDetail = flaggedDetails[0];

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "#dashboard", active: true },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy" },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "var(--space-6)",
        }}
      >
        {!summary ? (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Skeleton height={80} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <div>
                <h1 style={{ fontSize: 28, marginBottom: 4 }}>Good morning, {coordinatorFirstName}</h1>
                <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
                  Here&apos;s where things stand for the {householdLastName} household.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                <Card>
                  <CardKicker>Open bills</CardKicker>
                  <CardTitle>{formatMoney(openBillsOwed)} owed</CardTitle>
                  <div style={{ height: 6, background: "var(--color-neutral-200)", marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${openBillsPct}%`, background: "var(--color-accent)" }} />
                  </div>
                  <CardBody>
                    <a href="/bills" style={{ fontSize: 12 }}>
                      See all bills →
                    </a>
                  </CardBody>
                </Card>

                <Card>
                  <CardKicker>HSA balance</CardKicker>
                  <Skeleton height={22} width="70%" style={{ margin: "2px 0 8px" }} />
                  <Skeleton height={6} width="100%" style={{ marginBottom: 8 }} />
                  <p className="card-body" style={{ opacity: 0.7 }}>
                    Still syncing your HSA card — showing everything else in the meantime.
                  </p>
                </Card>

                <Card>
                  <CardKicker>Total household spend</CardKicker>
                  <CardTitle>{formatMoney(totalHouseholdSpend)} this year</CardTitle>
                  <div style={{ height: 6, background: "var(--color-neutral-200)", marginTop: 4, display: "flex", gap: 2 }}>
                    {memberSpend.map(({ member, spend }, i) => (
                      <div
                        key={member.id}
                        style={{
                          height: "100%",
                          width: totalHouseholdSpend > 0 ? `${(spend / totalHouseholdSpend) * 100}%` : 0,
                          background: MEMBER_SPEND_COLORS[i % MEMBER_SPEND_COLORS.length],
                        }}
                      />
                    ))}
                  </div>
                  <CardBody>
                    <a href="/household" style={{ fontSize: 12 }}>
                      See spend by family member →
                    </a>
                  </CardBody>
                </Card>
              </div>

              {flaggedDetails.length > 0 && (
                <section>
                  <SectionLabel>Needs your attention</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {flaggedDetails.map(({ bill, title, member, anomaly, owe }) => (
                      <Card
                        key={bill.id}
                        elevation="sm"
                        style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)", cursor: "pointer" }}
                        onClick={() => router.push(`/bills/${bill.id}`)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {anomaly ? anomaly.explanation.split(".")[0] + "." : title}
                          </div>
                          <CardMeta>
                            {member ? `${member.firstName} ${member.lastName}` : "Household"} · {formatMoney(owe)} flagged
                          </CardMeta>
                        </div>
                        <Tag variant="accent">Needs attention</Tag>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {summary.highlightedEpisodes.length > 0 && (
                <section>
                  <SectionLabel>Active care</SectionLabel>
                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    {summary.highlightedEpisodes.map((episode) => (
                      <Card
                        key={episode.id}
                        style={{ minWidth: 220, flex: "1 1 220px", cursor: "pointer" }}
                        onClick={() => router.push(`/episodes/${episode.id}`)}
                      >
                        <CardKicker>Episode</CardKicker>
                        <CardTitle>{episode.title}</CardTitle>
                        <CardMeta>
                          {episode.appointmentIds.length} appointment
                          {episode.appointmentIds.length === 1 ? "" : "s"} · {episode.documentIds.length} document
                          {episode.documentIds.length === 1 ? "" : "s"}
                        </CardMeta>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionLabel>Open tasks</SectionLabel>
                {openTasks.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Nothing open right now.
                  </p>
                ) : (
                  <div>
                    {openTasks.map((task) => {
                      const member = summary.members.find((m) => m.id === task.personId);
                      const isBillTask = task.source === "bill";
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            padding: "14px 0",
                            borderBottom: "1px solid var(--color-divider)",
                          }}
                        >
                          <div style={{ width: 20, height: 20, border: "1.5px solid var(--color-divider)", flex: "none" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.55 }}>
                              {member ? `${member.firstName} ${member.lastName}` : "Household"}
                              {task.due ? ` · Due ${formatShortDate(task.due)}` : ""}
                            </div>
                            {task.source === "system" && (
                              <div style={{ fontSize: 11, opacity: 0.55, color: "var(--color-accent-700)", marginTop: 3 }}>
                                ✦ Created by Westy
                              </div>
                            )}
                          </div>
                          <Tag variant={isBillTask ? "accent" : "neutral"}>
                            {isBillTask ? "Needs attention" : "Open"}
                          </Tag>
                          <Button variant="secondary" onClick={() => handleCompleteTask(task.id)}>
                            Mark complete
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <>
                    <Button variant="ghost" style={{ marginTop: 8 }} onClick={() => setShowCompleted((s) => !s)}>
                      {completedTasks.length} completed this month
                    </Button>
                    {showCompleted && (
                      <div style={{ marginTop: 8 }}>
                        {completedTasks.map((task) => {
                          const member = summary.members.find((m) => m.id === task.personId);
                          return (
                            <div
                              key={task.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-3)",
                                padding: "12px 0",
                                borderBottom: "1px solid var(--color-divider)",
                                opacity: 0.55,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, textDecoration: "line-through" }}>
                                  {task.title}
                                </div>
                                <div style={{ fontSize: 12 }}>{member ? `${member.firstName} ${member.lastName}` : "Household"}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>

              <section>
                <SectionLabel>Upcoming appointments</SectionLabel>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Nothing scheduled yet.
                  </p>
                ) : (
                  <div>
                    {upcomingAppointments.map(({ appointment, member }) => (
                      <div
                        key={appointment.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          padding: "14px 0",
                          borderBottom: "1px solid var(--color-divider)",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {PROVIDER_DIRECTORY[appointment.providerId] ?? appointment.providerId}
                          </div>
                          <CardMeta>
                            {member.firstName} {member.lastName} ·{" "}
                            {new Intl.DateTimeFormat("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(appointment.scheduledFor))}
                          </CardMeta>
                        </div>
                        {appointment.bookedVia === "agent" && <Tag variant="outline">Booked by Westy</Tag>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div>
              <SectionLabel>What&apos;s new</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {summary.pendingEpisodeSuggestions.map((suggestion) => (
                  <AiSurface key={suggestion.id}>
                    <p style={{ margin: "0 0 10px" }}>
                      We noticed a pattern that might be worth grouping as &quot;{suggestion.suggestedTitle}&quot;.
                    </p>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Button variant="secondary" onClick={() => handleDismissSuggestion(suggestion.id)}>
                        Dismiss
                      </Button>
                      <Button variant="primary" onClick={() => handleAcceptSuggestion(suggestion.id)}>
                        Group into an episode
                      </Button>
                    </div>
                  </AiSurface>
                ))}

                {primaryAnomalyDetail?.anomaly && (
                  <AiSurface>
                    <p style={{ margin: 0 }}>{primaryAnomalyDetail.anomaly.explanation}</p>
                  </AiSurface>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
