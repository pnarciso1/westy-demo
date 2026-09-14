"use client";

import { useEffect, useState } from "react";
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
import type { DashboardSummary } from "@westy/shared/client";
import { mockWestyClient } from "@/lib/mock";
import { AppNav } from "./components/AppNav";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockWestyClient.getCurrentUser().then((user) => {
      mockWestyClient.getDashboard(user.personId).then((data) => {
        if (!cancelled) setSummary(data);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAcceptSuggestion(suggestionId: string) {
    await mockWestyClient.acceptEpisodeSuggestion(suggestionId);
    const user = await mockWestyClient.getCurrentUser();
    setSummary(await mockWestyClient.getDashboard(user.personId));
  }

  async function handleDismissSuggestion(suggestionId: string) {
    await mockWestyClient.dismissEpisodeSuggestion(suggestionId);
    const user = await mockWestyClient.getCurrentUser();
    setSummary(await mockWestyClient.getDashboard(user.personId));
  }

  async function handleCompleteTask(taskId: string) {
    await mockWestyClient.completeTask(taskId);
    const user = await mockWestyClient.getCurrentUser();
    setSummary(await mockWestyClient.getDashboard(user.personId));
  }

  return (
    <>
      <AppNav active="dashboard" />
     <main style={{ padding: "var(--space-6)", maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {!summary ? (
          <>
            <Skeleton height={80} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </>
        ) : (
          <>
            <section>
              <SectionLabel>Household</SectionLabel>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {summary.members.map((person) => (
                  <Card key={person.id} style={{ minWidth: 200 }}>
                    <CardTitle>
                      {person.firstName} {person.lastName}
                    </CardTitle>
                    <CardMeta>{person.relationshipToCoordinator ?? "member"}</CardMeta>
                  </Card>
                ))}
              </div>
            </section>

            {summary.flaggedBills.length > 0 && (
              <section>
                <SectionLabel>Needs your attention</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {summary.flaggedBills.map((bill) => (
                    <Card key={bill.id}>
                      <div style={{ alignSelf: "flex-start" }}>
                        <Tag variant="accent">Flagged bill</Tag>
                      </div>
                      <CardBody>
                        This bill was flagged for review — likely something you don&apos;t owe.
                      </CardBody>
                      <div>
                        <Button variant="primary">Review</Button>
                      </div>
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
                    <Card key={episode.id} style={{ minWidth: 240 }}>
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

            {summary.openTasks.length > 0 && (
              <section>
                <SectionLabel>Open tasks</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {summary.openTasks.map((task) => (
                    <Card key={task.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <CardBody>{task.title}</CardBody>
                      <Button variant="secondary" onClick={() => handleCompleteTask(task.id)}>
                        Mark complete
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {summary.pendingEpisodeSuggestions.length > 0 && (
              <section>
                <SectionLabel>Suggested for you</SectionLabel>
                {summary.pendingEpisodeSuggestions.map((suggestion) => (
                  <AiSurface key={suggestion.id}>
                    We noticed a pattern that might be worth grouping as &quot;{suggestion.suggestedTitle}&quot;.
                    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                      <Button variant="primary" onClick={() => handleAcceptSuggestion(suggestion.id)}>
                        Group these
                      </Button>
                      <Button variant="ghost" onClick={() => handleDismissSuggestion(suggestion.id)}>
                        Not now
                      </Button>
                    </div>
                  </AiSurface>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
