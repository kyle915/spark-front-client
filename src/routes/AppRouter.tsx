import { Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router";
import { useAuthStore } from "@store/authStore";
import type { ReactNode } from "react";
import Login from "@/auth/Login";
import PrivateRoute from "@routes/PrivateRoute";
import { appRoutes } from "@/routes/AppRoutes";
import TenantRoute from "@/layout/TenantGuard";
import GoogleCalendarCallback from "@/auth/GoogleCalendarCallback";
import VerifyAccount from "@/auth/VerifyAccount";

const rootPath = "/";

// Single Suspense boundary at the router level so every lazy() route
// in AppRoutes can resolve without each route having to wrap itself.
// Fallback intentionally minimal — most pages also render Layout which
// has its own page-level Suspense for the data fetch.
const RouteFallback = () => (
  <div
    style={{
      display: "grid",
      placeItems: "center",
      height: "60vh",
      color: "rgba(255,255,255,0.55)",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 11,
      letterSpacing: "0.18em",
    }}
  >
    LOADING…
  </div>
);

const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Always accessible */}
        {/* <Route exact path="/token-expired" element={<AutoLogout />} /> */}
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/auth/google-calendar/callback"
          element={<GoogleCalendarCallback />}
        />
        <Route
          path="/verify-account"
          element={<VerifyAccount />}
        />
        {appRoutes.map((props, key) => (
          <Route
            key={key}
            path={props.path}
            element={
              props.isPublic ? (
                props.component
              ) : (
                <PrivateRoute
                  component={
                    props.path === "/select-company" ? (
                      props.component
                    ) : (
                      <TenantRoute component={props.component} />
                    )
                  }
                />
              )
            }
          />
        ))}
      </Routes>
    </Suspense>
  </BrowserRouter>
);

const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  return isAuthenticated ? (
    <Navigate to={rootPath} state={{ from: location }} />
  ) : (
    children
  );
};

export default AppRouter;
