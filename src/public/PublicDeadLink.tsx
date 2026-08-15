/**
 * Cream chrome for a dead public token — matches /approve and check-in
 * invalid. Never send the recipient to /login.
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
    <div className="min-h-[100dvh]" style={{ background: "#faf7f1" }}>
      <div className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-8">
          <a href={IGNITE_HOME} style={{ textDecoration: "none" }}>
            <img
              src="/legal/spark-logo.png"
              alt="Spark by Ignite"
              style={{ height: 28, width: "auto" }}
            />
          </a>
        </div>
        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500 mb-2">
            {eyebrow}
          </p>
          <h1
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {title}
          </h1>
          <p className="text-sm text-stone-600 mb-6">{message}</p>
          <p className="text-sm text-stone-600">{nextStep}</p>
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">
          Questions?{" "}
          <a className="underline" href={`mailto:${IGNITE_SUPPORT}`}>
            {IGNITE_SUPPORT}
          </a>
        </p>
      </div>
    </div>
  );
}
