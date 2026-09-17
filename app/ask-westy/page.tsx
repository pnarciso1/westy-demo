"use client";

import { useEffect, useState } from "react";
import { AiSurface, Button, TextInput, Skeleton } from "@westy/shared/ui";
import type { ChatMessage, ChatThread } from "@westy/shared";
import { AppNav } from "@/components/AppNav";
import { mockWestyClient } from "@/lib/mock";

export default function AskWesty() {
  const [personId, setPersonId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await mockWestyClient.getCurrentUser();
      const person = await mockWestyClient.getPerson(user.personId);
      setPersonId(user.personId);
      setFirstName(person.firstName);
      setThread(await mockWestyClient.getChatThread(user.personId));
    })();
  }, []);

  async function handleSend() {
    const text = messageText.trim();
    if (!text || !personId || sending) return;
    setMessageText("");
    setSending(true);
    // sendChatMessage only returns the assistant's reply — we're responsible
    // for showing the user's own message immediately ourselves.
    const userMessage: ChatMessage = { id: `local-${Date.now()}`, role: "user", text, isAiGenerated: false };
    setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, userMessage] } : prev));
    const reply = await mockWestyClient.sendChatMessage(personId, text);
    setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, reply] } : prev));
    setSending(false);
  }

  return (
    <>
      <AppNav
        brand="Westy"
        links={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bills", href: "/bills" },
          { label: "Household", href: "/household" },
          { label: "Connections", href: "/connections" },
          { label: "Ask Westy", href: "/ask-westy", active: true },
        ]}
      />
      <main
        style={{
          padding: "var(--space-6)",
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Ask Westy</h1>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 24 }}>
            Ask about a bill, a family member&apos;s care, or what&apos;s on your plate this week.
          </p>
        </div>

        {!thread ? (
          <Skeleton height={360} />
        ) : (
          <div style={{ border: "1px solid var(--color-divider)", minHeight: 360, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                flex: 1,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                maxHeight: 480,
                overflowY: "auto",
              }}
            >
              <div style={{ alignSelf: "flex-start", maxWidth: "80%" }}>
                <AiSurface>
                  <p style={{ margin: 0 }}>
                    Hi {firstName}. Ask me anything about your family&apos;s bills, care team, or tasks.
                  </p>
                </AiSurface>
              </div>

              {thread.messages.map((message) =>
                message.role === "assistant" ? (
                  <div key={message.id} style={{ alignSelf: "flex-start", maxWidth: "80%" }}>
                    <AiSurface>
                      <p style={{ margin: 0 }}>{message.text}</p>
                    </AiSurface>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: "flex-end",
                      background: "var(--color-surface)",
                      padding: "12px 14px",
                      maxWidth: "80%",
                      fontSize: 14,
                    }}
                  >
                    {message.text}
                  </div>
                )
              )}

              {sending && (
                <div style={{ alignSelf: "flex-start", maxWidth: "80%" }}>
                  <AiSurface>
                    <p style={{ margin: 0 }}>Westy is typing…</p>
                  </AiSurface>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--color-divider)" }}>
              <div style={{ flex: 1 }}>
                <TextInput
                  placeholder="Type a question for Westy…"
                  value={messageText}
                  disabled={sending}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                />
              </div>
              <Button variant="primary" disabled={sending || !messageText.trim()} onClick={handleSend}>
                Send
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
