import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Recap Templates.
 * Wireframe: spark-demo/index.html recapBuilder (~line 2744) and adjacent.
 *
 * We surface templates by reducing the customRecaps result set down to
 * unique customRecapTemplate entries, with usage counts. A dedicated
 * templates-list endpoint would be cleaner; until then, this works against
 * the existing schema.
 */

type Template = {
  id: string;
  name: string;
  usage: number;
  lastUsed: string | null;
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const templates: Template[] = useMemo(() => {
    const map = new Map<string, Template>();
    const recaps =
      data?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of recaps) {
      const t = r.customRecapTemplate;
      if (!t) continue;
      const id = String(t.id);
      const existing = map.get(id);
      const submittedAt = r.submittedAt ?? r.createdAt;
      if (!existing) {
        map.set(id, {
          id,
          name: t.name ?? "Untitled template",
          usage: 1,
          lastUsed: submittedAt ?? null,
        });
      } else {
        existing.usage += 1;
        if (
          submittedAt &&
          (!existing.lastUsed ||
            new Date(submittedAt) > new Date(existing.lastUsed))
        ) {
          existing.lastUsed = submittedAt;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.usage - a.usage);
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            RECAP TEMPLATES · {templates.length} ACTIVE
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Build the recap.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Custom recap shapes per brand — what BAs see when they file
            from the field.
          </p>
        </div>
        <button
          onClick={() => navigate("/recap/custom-list")}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.35)",
          }}
        >
          + New template
        </button>
      </div>

      {/* Templates grid */}
      {templates.length === 0 ? (
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No templates yet. Build one to start collecting custom recap
          fields per brand.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate("/recap/custom-list")}
              className="spark-card hov p-5 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-lime)",
                  }}
                >
                  TPL-{t.id.slice(-4).toUpperCase()}
                </span>
                <span className="chip chip-lime">● ACTIVE</span>
              </div>
              <h3
                className="display text-lg font-bold mb-1"
                style={{ letterSpacing: "-0.02em" }}
              >
                {t.name}
              </h3>
              {t.lastUsed && (
                <p
                  className="mono text-[10px] uppercase mt-1"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  Last used · {fmtDate(t.lastUsed)}
                </p>
              )}
              <div
                className="mt-4 pt-3 grid grid-cols-2 gap-2 text-center"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <div>
                  <p
                    className="tab-num text-lg font-bold"
                    style={{ color: "var(--spark-lime)" }}
                  >
                    {t.usage}
                  </p>
                  <p className="label-mini">RECAPS</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">—</p>
                  <p className="label-mini">FIELDS</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SparkRecapTemplates() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading templates…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
