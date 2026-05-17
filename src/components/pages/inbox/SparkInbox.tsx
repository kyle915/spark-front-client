import { useState } from "react";
import Layout from "@/layout/Layout";

/**
 * Spark v2 — Inbox.
 * Wireframe: spark-demo/index.html lines 2359-2395.
 *
 * Two-pane: conversation list (left) + active thread (right). Currently
 * static demo data — wires to a chats backend when chats_* tables are
 * exposed via the GraphQL API.
 */

type Convo = {
  id: string;
  name: string;
  initials: string;
  subject: string;
  preview: string;
  when: string;
  unread: boolean;
  location?: string;
};

type Msg = { who: "me" | "them"; initials: string; body: string; at: string };

const CONVOS: Convo[] = [
  {
    id: "maya",
    name: "Maya R.",
    initials: "MR",
    subject: "Re: Whole Foods Lamar",
    preview: "Wait — should I bring the cooler?",
    when: "2m",
    unread: true,
    location: "AUSTIN · ★ 4.9 · 142 JOBS",
  },
  {
    id: "devon",
    name: "Devon K.",
    initials: "DK",
    subject: "Mohawk Patio Saturday",
    preview: "Confirmed. Heading down 5:30.",
    when: "14m",
    unread: true,
  },
  {
    id: "priya",
    name: "Priya S.",
    initials: "PS",
    subject: "Denver setup",
    preview: "Storage room access?",
    when: "1h",
    unread: true,
  },
  {
    id: "ross",
    name: "Ross K.",
    initials: "RK",
    subject: "Re: Master Tracker",
    preview: "Can we filter by RMM?",
    when: "3h",
    unread: false,
  },
  {
    id: "jordan",
    name: "Jordan T.",
    initials: "JT",
    subject: "Cooler hand-off",
    preview: "I have one in the trunk.",
    when: "5h",
    unread: false,
  },
];

const MSGS: Record<string, Msg[]> = {
  maya: [
    { who: "them", initials: "MR", body: "Confirmed for Saturday — 12 to 8. I have my own apron + black tee.", at: "11:42 AM" },
    { who: "me", initials: "K", body: "Perfect. Manager contact in the brief. Pull from cooler stock, not floor stock.", at: "11:43 AM" },
    { who: "them", initials: "MR", body: "Got it. Mohawk last weekend ran out by 7pm — pace different here?", at: "11:48 AM" },
    { who: "me", initials: "K", body: "Start at 6oz pours, not 8. Whole Foods is short Q afternoon, dinner rush 5–7.", at: "11:50 AM" },
    { who: "them", initials: "MR", body: "Wait — should I bring the cooler from the Brooklyn job?", at: "12:01 PM" },
  ],
};

export default function SparkInbox() {
  const [active, setActive] = useState<string>("maya");
  const [draft, setDraft] = useState("");
  const current = CONVOS.find((c) => c.id === active) ?? CONVOS[0];
  const thread = MSGS[active] ?? [];

  return (
    <Layout>
      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: "320px 1fr",
          minHeight: "calc(100vh - 200px)",
        }}
      >
        {/* List */}
        <div className="spark-card overflow-hidden flex flex-col">
          <div
            className="p-4"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <h2
              className="display font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Inbox
            </h2>
            <input
              placeholder="Search messages…"
              className="rounded-xl text-sm mt-3"
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            />
          </div>
          <ul className="overflow-y-auto flex-1">
            {CONVOS.map((c) => {
              const on = c.id === active;
              return (
                <li
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className="px-4 py-3 cursor-pointer transition"
                  style={{
                    borderBottom: "1px solid var(--spark-border)",
                    background: on ? "rgba(197,245,70,0.06)" : "transparent",
                    borderLeft: on
                      ? "2px solid var(--spark-lime)"
                      : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="spark-avatar" style={{ width: 36, height: 36 }}>
                      {c.initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">
                          {c.name}
                        </p>
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: c.unread
                              ? "var(--spark-lime)"
                              : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {c.when}
                        </span>
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{
                          color: c.unread
                            ? "var(--spark-text)"
                            : "rgba(255,255,255,0.55)",
                          fontWeight: c.unread ? 600 : 400,
                        }}
                      >
                        {c.preview}
                      </p>
                    </div>
                    {c.unread && (
                      <span
                        className="spark-dot"
                        style={{ width: 8, height: 8 }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Thread */}
        <div className="spark-card overflow-hidden flex flex-col">
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <div className="flex items-center gap-3">
              <span className="spark-avatar" style={{ width: 40, height: 40 }}>
                {current.initials}
              </span>
              <div>
                <p className="font-bold">{current.name}</p>
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {current.location ?? "BA"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            {thread.length === 0 ? (
              <p
                className="text-sm text-center mt-12"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No messages yet.
              </p>
            ) : (
              thread.map((m, i) => {
                const mine = m.who === "me";
                return (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}
                  >
                    {!mine && (
                      <span
                        className="spark-avatar"
                        style={{ width: 28, height: 28, fontSize: "0.65rem" }}
                      >
                        {m.initials}
                      </span>
                    )}
                    <div
                      className="rounded-2xl px-4 py-2.5 max-w-[70%]"
                      style={{
                        background: mine
                          ? "var(--spark-lime)"
                          : "var(--spark-surface-2)",
                        color: mine ? "#0a0d09" : "var(--spark-text)",
                        border: mine
                          ? "none"
                          : "1px solid var(--spark-border)",
                      }}
                    >
                      <p className="text-sm leading-relaxed">{m.body}</p>
                      <p
                        className="mono text-[9px] mt-1"
                        style={{
                          letterSpacing: "0.14em",
                          color: mine
                            ? "rgba(10,13,9,0.55)"
                            : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {m.at}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="p-3 flex items-center gap-2"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${current.name}…`}
              className="rounded-xl flex-1 text-sm"
              style={{
                padding: "0.6rem 0.85rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            />
            <button
              onClick={() => setDraft("")}
              disabled={!draft.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                opacity: draft.trim() ? 1 : 0.4,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
