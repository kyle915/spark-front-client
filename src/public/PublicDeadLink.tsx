/**
 * Light studio paper chrome for a dead public token — matches /spark-form,
 * /report, /program, /pitch, and /invoice. Never sends recipients to /login.
 */

const IGNITE_HOME = "https://www.igniteproductions.co/";
const IGNITE_SUPPORT = "staffing@igniteproductions.co";

export default function PublicDeadLink({
  eyebrow,
  title,
  message,
  nextStep = "Ask your Ignite contact for a fresh link, or email staffing. This page will not sign you into Spark.",
}: {
  eyebrow: string;
  title: string;
  message: string;
  nextStep?: string;
}) {
  return (
    <div
      data-theme="spark-v2"
      data-spark-mode="light"
      className="min-h-[100dvh]"
      style={{
        background: "var(--spark-bg, #f6f6f2)",
        color: "var(--spark-text, #14160f)",
        colorScheme: "light",
      }}
    >
      <div className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-8">
          <a href={IGNITE_HOME} style={{ textDecoration: "none" }}>
            <img
              src="/legal/spark-logo.png"
              alt="Spark by Ignite"
              style={{ height: 26, width: "auto" }}
            />
          </a>
        </div>
        <div
          className="rounded-xl p-8"
          style={{
            background: "#ffffff",
            border: "1px solid var(--spark-border, #dcddd5)",
          }}
        >
          <p
            className="mono text-[10px] font-semibold uppercase mb-2"
            style={{
              letterSpacing: "0.2em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))",
            }}
          >
            {eyebrow}
          </p>
          <h1
            className="display text-2xl font-bold mb-3"
            style={{
              letterSpacing: "-0.025em",
              color: "var(--spark-text, #14160f)",
            }}
          >
            {title}
          </h1>
          <p
            className="text-sm leading-relaxed mb-4"
            style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))" }}
          >
            {message}
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.64))" }}
          >
            {nextStep}
          </p>
        </div>
        <p
          className="mt-6 text-center text-xs"
          style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.56))" }}
        >
          Questions?{" "}
          <a
            className="underline"
            href={`mailto:${IGNITE_SUPPORT}`}
            style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))" }}
          >
            {IGNITE_SUPPORT}
          </a>
        </p>
      </div>
    </div>
  );
}
