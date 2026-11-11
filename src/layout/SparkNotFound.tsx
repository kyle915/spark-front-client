import { Link, useLocation } from "react-router";
import Layout from "./Layout";

/**
 * Catch-all for signed-in users who land on a URL that isn't a Spark page
 * (a mistyped link, a retired route). Without this the shell rendered an
 * empty main area with no way to tell what went wrong.
 */
export const SparkNotFound: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <Layout>
      <div className="spark-card p-10 text-center max-w-2xl">
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-orange)" }}
        >
          PAGE NOT FOUND
        </p>
        <h1
          className="display text-2xl font-bold mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          There's no page at this address.
        </h1>
        <p
          className="mt-3 text-sm break-all"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          <span className="mono">{pathname}</span> doesn't match anything in
          Spark. The link may be mistyped or out of date.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
          >
            Go to Dashboard
          </Link>
          <Link
            to="/recaps/list"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Recaps
          </Link>
          <Link
            to="/requests/list"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Master Tracker
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default SparkNotFound;
