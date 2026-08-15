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
import { AppShellSkeleton } from "@/layout/PageSkeletons";

const rootPath = "/";

// Single Suspense boundary at the router level so every lazy() route
// in AppRoutes can resolve without each route having to wrap itself.
// Keep the sidebar + topbar silhouette visible — a floating content
// skeleton (or worse, "LOADING…") blanks the shell for the whole
// chunk-fetch + first query, which is the 5–7s black screen on
// dashboard / recaps navigations.
const RouteFallback = () => <AppShellSkeleton />;

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
