import { Navigate, useLocation } from "react-router";
import type { ReactElement } from "react";
import { useAuthStore } from "@/store/authStore";

interface PrivateRouteProps {
  component: ReactElement;
}

function readStoredToken(): string | null {
  if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
    return null;
  }
  try {
    return localStorage.getItem("@token");
  } catch {
    return null;
  }
}

const PrivateRoute = ({ component }: PrivateRouteProps) => {
  const location = useLocation();
  const storeToken = useAuthStore((s) => s.token);
  const jwtToken = storeToken ?? readStoredToken();
  const isAuth = Boolean(jwtToken);

  if (isAuth) {
    return component;
  }
  return <Navigate to="/login" state={{ from: location }} />;
};

export default PrivateRoute;
