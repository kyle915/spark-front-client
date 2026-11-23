import type { ReactNode } from "react";
import useSparkRole from "@/hooks/useSparkRole";
import Layout from "./Layout";

/**
 * Wraps a page so clients hitting the URL get a friendly "admin-only"
 * notice instead of the screen contents. Use at the route component level.
 *
 * Brand clients (`canToggleRole=false`) are always forced into client
 * chrome by useSparkRole, so this gate cannot be bypassed by flipping
 * localStorage `@spark.role` to admin.
 */
export const AdminOnly: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isClient, canToggleRole } = useSparkRole();
  if (!isClient) return <>{children}</>;
  return (
    <Layout>
      <div
        className="spark-card p-10 text-center max-w-2xl"
        style={{ borderColor: "rgba(255,138,76,0.3)" }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-orange)",
          }}
        >
          ADMIN VIEW REQUIRED
        </p>
        <h1
          className="display text-2xl font-bold mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          This page is for Ignite team members.
        </h1>
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {canToggleRole ? (
            <>
              Toggle <span className="mono">Admin</span> in the topbar to
              access internal tools.
            </>
          ) : (
            <>
              Your account is signed in as a brand client, so Ignite staff
              tools stay hidden.
            </>
          )}
        </p>
      </div>
    </Layout>
  );
};

export default AdminOnly;
