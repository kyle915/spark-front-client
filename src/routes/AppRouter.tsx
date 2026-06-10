import { Suspense, useEffect } from "react";
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
import { appRoutes, prefetchHotRoutes } from "@/routes/AppRoutes";
import TenantRoute from "@/layout/TenantGuard";
import GoogleCalendarCallback from "@/auth/GoogleCalendarCallback";
import VerifyAccount from "@/auth/VerifyAccount";

const rootPath = "/";

// Single Suspense boundary at the router level so every lazy() route
// in AppRoutes can resolve without each route having to wrap itself.
// The fallback is a SKELETON page shell (shimmering header + content
// blocks — see .skeleton-block in index.css) rather than a "LOADING…"
// string: the page reads as already-arriving instead of stalled, which
// is most visible during the brief chunk fetch on uncached routes.
const RouteFallback = () => (
  <div
    aria-busy="true"
    aria-label="Loading page"
    style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "48px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}
  >
    <div className="skeleton-block" style={{ height: 32, width: "32%" }} />
    <div className="skeleton-block" style={{ height: 14, width: "55%" }} />
    <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton-block"
          style={{ height: 96, flex: 1 }}
        />
      ))}
    </div>
    <div className="skeleton-block" style={{ height: 320, marginTop: 8 }} />
  </div>
);

const AppRouter = () => {
  // Warm the hot-path chunks (tracker / dashboard / request views) during
  // browser idle — typically while the user is still on the login screen —
  // so the first click after sign-in hits cached modules, not the network.
  useEffect(() => {
    prefetchHotRoutes();
  }, []);

  return (
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
                  component={<TenantRoute component={props.component} />}
                />
              )
            }
          />
        ))}
      </Routes>
    </Suspense>
  </BrowserRouter>
  );
};

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
