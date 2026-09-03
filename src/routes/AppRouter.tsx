import { Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
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
import { LayoutChrome } from "@/layout/Layout";
import { LayoutShellContext } from "@/layout/LayoutShellContext";

const rootPath = "/";

// Single Suspense boundary at the router level so every lazy() route
// in AppRoutes can resolve without each route having to wrap itself.
// Keep the sidebar + topbar silhouette visible — a floating content
// skeleton (or worse, "LOADING…") blanks the shell for the whole
// chunk-fetch + first query, which is the 5–7s black screen on
// dashboard / recaps navigations.
const RouteFallback = () => <AppShellSkeleton />;

/**
 * Persistent chrome for every private route. LayoutShellContext tells
 * page-level `<Layout>` to passthrough so sidebar / topbar / chat
 * polling survive client-side navigations.
 */
const AuthenticatedShell = () => (
  <LayoutShellContext.Provider value={true}>
    <LayoutChrome>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </LayoutChrome>
  </LayoutShellContext.Provider>
);

const AppRouter = () => {
  // Warm the hot-path chunks (tracker / dashboard / request views) during
  // browser idle — typically while the user is still on the login screen —
  // so the first click after sign-in hits cached modules, not the network.
  useEffect(() => {
    prefetchHotRoutes();
  }, []);

  const publicRoutes = appRoutes.filter((r) => r.isPublic);
  const privateRoutes = appRoutes.filter((r) => !r.isPublic);

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
        {publicRoutes.map((props, key) => (
          <Route
            key={`public-${key}`}
            path={props.path}
            element={props.component}
          />
        ))}
        {/* Private routes share one LayoutChrome via AuthenticatedShell so
            navigating between pages does not remount sidebar / topbar. */}
        <Route
          element={
            <PrivateRoute
              component={
                <TenantRoute component={<AuthenticatedShell />} />
              }
            />
          }
        >
          {privateRoutes.map((props, key) => (
            <Route
              key={`private-${key}`}
              path={props.path}
              element={props.component}
            />
          ))}
        </Route>
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
