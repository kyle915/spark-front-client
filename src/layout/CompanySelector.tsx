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
};
type TenantEdge = TenantQueryType["response"]["tenants"]["edges"][number];

export default function CompanySelector() {
  const [selected, setSelected] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuthStore();
  const { selectTenant, tenantUuid } = useTenantSelection();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const variables: TenantQueryType["variables"] = user?.uuid
      ? { userUuid: user.uuid }
      : {};

    fetchQuery<TenantQueryType>(environment, TenantQuery, variables)
      .toPromise()
      .then((data) => {
        if (!isMounted) return;
        const tenantCompanies: Company[] =
          data?.tenants?.edges?.map((tenantEdge: TenantEdge) => {
            const tenant = tenantEdge.node;
            return {
              id: tenant.id,
              uuid: String(tenant.uuid),
              name: tenant.name,
              logo: null,
            };
          }) ?? [];

        setCompanies(tenantCompanies);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message =
          err instanceof Error
            ? err.message
            : "The companies could not be loaded.";
        setError(message);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.uuid, reloadKey]);

  useEffect(() => {
    if (!loading && companies.length === 1) {
      const [company] = companies;
      setSelected(company.id);
      selectTenant(company.uuid, company.id);
      navigate(from, { replace: true });
    }
  }, [companies, navigate, loading, selectTenant, from]);

  useEffect(() => {
    if (!tenantUuid || !companies.length) return;
    const company = companies.find((c) => c.uuid === tenantUuid);
    if (company) {
      setSelected(company.id);
    }
  }, [tenantUuid, companies]);

  const handleSelect = (company: Company) => {
    setSelected(company.id);
    selectTenant(company.uuid, company.id);

    navigate(`/dashboard/${company.uuid}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 gap-4 text-base-content">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p>Loading companies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 gap-4 text-center text-base-content">
        <p>{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => setReloadKey((prev) => prev + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!companies.length) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-base-content">
        <p>We cannot find any companies associated with your user account.</p>
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
            onClick={() => handleSelect(company)}
            className={`card bg-base-200 shadow-xl cursor-pointer transition transform hover:scale-105 border-2 ${
              selected === company.id
                ? "border-primary ring ring-primary ring-offset-2"
                : "border-transparent"
            }`}
          >
            <div className="card-body items-center text-center">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-32 h-32 object-contain mb-4"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold mb-4">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <h3 className="text-xl font-semibold text-base-content">
                {company.name}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-10 text-lg text-base-content">
          You have selected:{" "}
          <span className="font-bold text-primary">
            {companies.find((c) => c.id === selected)?.name}
          </span>
        </div>
      )}
    </div>
  );
}
