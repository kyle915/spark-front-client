import React, { Suspense } from "react";
import { useNavigate, useParams } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { AcademyModuleQuery } from "@/api/queries/AcademyModuleQuery";
import type { AcademyModuleQuery as AcademyModuleQueryType } from "@api/queries/__generated__/AcademyModuleQuery.graphql";
import { kindColor, kindLabel } from "@/lib/academy";

/**
 * BA-facing read view of a single academy module. The module is loaded
 * from the backend `academyModule(uuid)` query — the `:id` route param
 * is the module uuid. Body renders as plain text (with markdown-like
 * heading detection).
 *
 * Note: the backend `AcademyModule` model has no per-user progress /
 * "completed" field, so the "I've read this" button is navigation-only.
 */
const ViewerInner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<AcademyModuleQueryType>(
    AcademyModuleQuery,
    { uuid },
    { fetchPolicy: "store-or-network" },
  );
  const m = data.academyModule;

  if (!m) {
    return (
      <div
        className="spark-card p-10 text-center text-sm max-w-3xl"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Module not found.
      </div>
    );
  }

  const color = kindColor(m.kind);

  return (
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
          {kindLabel(m.kind).toUpperCase()}
        </span>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          {m.title}
        </h1>
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

      <button
        onClick={() => navigate("/academy")}
        className="w-full py-3 rounded-2xl text-sm font-semibold"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0d09",
        }}
      >
        ✓ I've read this · Back to academy
      </button>
    </div>
  );
};

export default function SparkAcademyViewer() {
  const { id } = useParams<{ id: string }>();

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading module…
          </div>
        }
      >
        {id ? (
          <ViewerInner uuid={id} />
        ) : (
          <div
            className="spark-card p-10 text-center text-sm max-w-3xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Module not found.
          </div>
        )}
      </Suspense>
    </Layout>
  );
}
