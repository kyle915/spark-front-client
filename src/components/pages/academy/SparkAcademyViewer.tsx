import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import {
  loadModules,
  KIND_LABEL,
  KIND_COLOR,
  type AcademyModule,
} from "@/lib/academy";

/**
 * BA-facing read view of a single academy module. Body renders as plain
 * text (with markdown-like heading detection). Attachments open in a new
 * tab.
 */
export default function SparkAcademyViewer() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const [m, setM] = useState<AcademyModule | null>(null);

  useEffect(() => {
    if (!tenantId || !id) return;
    const list = loadModules(tenantId);
    setM(list.find((x) => x.id === id) ?? null);
  }, [tenantId, id]);

  if (!m) {
    return (
      <Layout>
        <div
          className="spark-card p-10 text-center text-sm max-w-3xl"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Module not found.
        </div>
      </Layout>
    );
  }

  const color = KIND_COLOR[m.kind];

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <button
          onClick={() => navigate("/academy")}
          className="mono text-[11px] transition"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ← BACK TO ACADEMY
        </button>

        <div>
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color,
            }}
          >
            {KIND_LABEL[m.kind].toUpperCase()} · {m.estMinutes} MIN READ
          </span>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {m.title}
          </h1>
          {m.summary && (
            <p
              className="mt-2 text-base"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {m.summary}
            </p>
          )}
        </div>

        {m.body && (
          <div
            className="spark-card p-6"
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {m.body.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return (
                  <h2
                    key={i}
                    className="display font-bold mt-4 mb-2"
                    style={{
                      fontSize: 22,
                      letterSpacing: "-0.02em",
                      color: "var(--spark-text)",
                    }}
                  >
                    {line.slice(2)}
                  </h2>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h3
                    key={i}
                    className="display font-bold mt-3 mb-2"
                    style={{
                      fontSize: 18,
                      letterSpacing: "-0.02em",
                      color: "var(--spark-text)",
                    }}
                  >
                    {line.slice(3)}
                  </h3>
                );
              }
              if (line.startsWith("- ") || /^\d+\.\s/.test(line)) {
                return (
                  <p key={i} style={{ marginLeft: 16, marginBottom: 6 }}>
                    {line}
                  </p>
                );
              }
              if (line.trim() === "") return <div key={i} style={{ height: 12 }} />;
              return (
                <p key={i} style={{ marginBottom: 10 }}>
                  {line}
                </p>
              );
            })}
          </div>
        )}

        {m.attachments.length > 0 && (
          <div className="spark-card p-6">
            <h3 className="display font-bold mb-3">Attachments</h3>
            <div className="space-y-2">
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl transition"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <span
                    className="mono text-[10px] w-10 text-center"
                    style={{
                      letterSpacing: "0.16em",
                      color,
                    }}
                  >
                    {a.kind.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p
                      className="mono text-[10px] truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {a.url}
                    </p>
                  </div>
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    OPEN →
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/academy")}
          className="w-full py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 18px rgba(197,245,70,0.35)",
          }}
        >
          ✓ I've read this · Back to academy
        </button>
      </div>
    </Layout>
  );
}
