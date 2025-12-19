import { Navigate, useLocation } from "react-router";
import { useTenantSelection } from "@/hooks/useTenantSelection";
import type { ReactElement } from "react";

interface TenantRouteProps {
  component: ReactElement;
}

export default function TenantRoute({ component }: TenantRouteProps) {
  const location = useLocation();
  const { tenantUuid } = useTenantSelection();

  if (!tenantUuid) {
    return <Navigate to="/select-company" state={{ from: location }} replace />;
  }

  return component;
}
