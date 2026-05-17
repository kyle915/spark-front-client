import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@api/queries/__generated__/TenantQuery.graphql";
import { fetchQuery } from "relay-runtime";
import environment from "@api/relay/environment";
import { useAuthStore } from "@store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";

type Company = {
  id: string;
  uuid: string;
  name: string;
  logo?: string | null;
  requestUrlName?: string | null;
  tenantSlug?: string | null;
};

type TenantEdge = TenantQueryType["response"]["tenants"]["edges"][number];

export default function CompanySelector() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuthStore();
  const { selectTenant } = useTenantSelection();

  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  useEffect(() => {
    let isMounted = true;

    const variables: TenantQueryType["variables"] = user?.uuid
      ? { userUuid: user.uuid }
      : {};

    fetchQuery<TenantQueryType>(environment, TenantQuery, variables)
      .toPromise()
      .then((data) => {
        if (!isMounted) return;

        const tenantCompanies: Company[] =
          data?.tenants?.edges?.map((edge: TenantEdge) => {
            const tenant = edge.node;
            return {
              id: tenant.id,
              uuid: String(tenant.uuid),
              name: tenant.name,
              logo: tenant.image,
              requestUrlName: tenant.requestUrlName,
              tenantSlug: tenant.tenantSlug,
            };
          }) ?? [];

        // 👉 CASO: SOLO UN TENANT → AUTOSELECT + REDIRECT
        if (tenantCompanies.length === 1) {
          const [company] = tenantCompanies;
          selectTenant({
            tenantUuid: company.uuid,
            tenantId: company.id,
            logo: company.logo,
            requestUrlName: company.requestUrlName,
            tenantSlug: company.tenantSlug,
          });

          navigate(from, { replace: true });
          return;
        }

        setCompanies(tenantCompanies);
        setLoading(false);
      })
      .catch(() => {
        // 👉 ERROR DE API = LOGOUT
        logout();
        navigate("/login", { replace: true });
      });

    return () => {
      isMounted = false;
    };
  }, [user?.uuid, logout, navigate, from, selectTenant]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!companies.length) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4 text-base-content">
        <p className="text-lg">No companies associated with this account.</p>

        <button onClick={handleLogout} className="btn btn-outline btn-error">
          Logout
        </button>
      </div>
    );
  }

  const isOdd = companies.length % 2 !== 0;

  return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6">
      <h2 className="text-2xl font-bold text-base-content mb-8">
        Select your company
      </h2>

      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl ${
          isOdd
            ? "md:[&>*:last-child]:col-span-2 md:[&>*:last-child]:justify-self-center md:[&>*:last-child]:w-1/2"
            : ""
        }`}
      >
        {companies.map((company) => (
          <div
            key={company.id}
            onClick={() => {
              selectTenant({
                tenantUuid: company.uuid,
                tenantId: company.id,
                logo: company.logo,
                requestUrlName: company.requestUrlName,
                tenantSlug: company.tenantSlug,
              });
              // Dashboard lives at "/" (see AppRoutes DashboardLinks).
              // Previously navigated to /dashboard/<uuid> which had no
              // matching route, leaving the screen blank.
              navigate(from, { replace: true });
            }}
            className="card bg-base-200 shadow-xl cursor-pointer transition transform hover:scale-105 border-2 border-transparent hover:border-primary"
          >
            <div className="card-body items-center text-center">
              <div className="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold mb-4">
                {company.name.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="text-xl font-semibold text-base-content">
                {company.name}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
