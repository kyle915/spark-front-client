import SparkNotFound from "@/layout/SparkNotFound";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  type Location,
} from "react-router";
import { useAuthStore } from "@store/authStore";
import type { ReactNode } from "react";
import Login from "@/auth/Login";
import PrivateRoute from "@routes/PrivateRoute";
import { appRoutes, prefetchHotRoutes } from "@/routes/AppRoutes";
import TenantRoute from "@/layout/TenantGuard";
import { LegalGate } from "@/legal/acceptance/LegalGate";
import GoogleCalendarCallback from "@/auth/GoogleCalendarCallback";
import VerifyAccount from "@/auth/VerifyAccount";
import { AppShellSkeleton, RouteContentSkeleton } from "@/layout/PageSkeletons";
import { LayoutChrome } from "@/layout/Layout";
import { LayoutShellContext } from "@/layout/LayoutShellContext";
import {
  canStartViewTransition,
  hubRootSegment,
  isHubSwitch,
  type DocumentWithViewTransition,
  type ViewTransitionHandle,
} from "@/layout/routeViewTransition";
import environment, { useWorkspaceEpoch } from "@/api/relay/environment";
import { prefetchHotRelayData } from "@/lib/prefetchHotRelayData";
import useSparkRole from "@/hooks/useSparkRole";

const rootPath = "/";

const RouteFallback = () => <AppShellSkeleton />;

/** Idle-warm tracker / recaps / role-appropriate Relay data once tenant is known. */
const HotRelayPrefetch = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { isClient } = useSparkRole();
  useEffect(() => {
    prefetchHotRelayData(environment, tenantId, { isClient });
  }, [tenantId, isClient]);
  return null;
};

/**
 * Persistent chrome for every private route. LayoutShellContext tells
 * page-level `<Layout>` to passthrough so sidebar / topbar / chat
 * polling survive client-side navigations, while `.spark-route-stage`
 * scopes the 140ms View Transition cross-fade strictly to the content pane.
 */
const AuthenticatedShell = () => {
  const workspaceEpoch = useWorkspaceEpoch();
  const location = useLocation();
  return (
    <LayoutShellContext.Provider value={true}>
      <HotRelayPrefetch />
      <LayoutChrome>
        <div
          className="spark-route-stage"
          data-hub={hubRootSegment(location.pathname)}
        >
          <Suspense key={workspaceEpoch} fallback={<RouteContentSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </LayoutChrome>
    </LayoutShellContext.Provider>
  );
};

/**
 * Progressive, prefers-reduced-motion-safe 140ms View Transition wrapper
 * around `<Routes>` inside `<BrowserRouter>`. Only cross-hub switches run
 * `document.startViewTransition`; sub-tab switches, open drawers, reduced
 * motion, and non-VT browsers commit immediately without extra frames.
 */
const HubViewTransitionRoutes = ({ children }: { children: ReactNode }) => {
  const liveLocation = useLocation();
  const [renderedLocation, setRenderedLocation] = useState<Location>(liveLocation);
  const activeVtRef = useRef<ViewTransitionHandle | null>(null);

  const vtEligible =
    renderedLocation.key !== liveLocation.key &&
    isHubSwitch(renderedLocation.pathname, liveLocation.pathname) &&
    canStartViewTransition();

  const effectiveLocation = vtEligible ? renderedLocation : liveLocation;

  useLayoutEffect(() => {
    if (renderedLocation.key === liveLocation.key) return;
    if (!vtEligible) {
      setRenderedLocation(liveLocation);
      return;
    }
    const doc = document as unknown as DocumentWithViewTransition;
    activeVtRef.current?.skipTransition?.();
    try {
      const handle = doc.startViewTransition?.(() => {
        flushSync(() => {
          setRenderedLocation(liveLocation);
        });
      });
      activeVtRef.current = handle ?? null;
      handle?.finished?.catch(() => {
        /* aborted or superseded transition */
      });
    } catch {
      setRenderedLocation(liveLocation);
    }
  }, [liveLocation, renderedLocation.key, vtEligible]);

  return <Routes location={effectiveLocation}>{children}</Routes>;
};

const AppRouter = () => {
  useEffect(() => {
    prefetchHotRoutes();
  }, []);

  const publicRoutes = appRoutes.filter((r) => r.isPublic);
  const privateRoutes = appRoutes.filter((r) => !r.isPublic);

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <HubViewTransitionRoutes>
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
          <Route path="/verify-account" element={<VerifyAccount />} />
          {publicRoutes.map((props, key) => (
            <Route
              key={`public-${key}`}
              path={props.path}
              element={props.component}
            />
          ))}
          <Route
            element={
              <PrivateRoute
                component={
                  <LegalGate>
                    <TenantRoute component={<AuthenticatedShell />} />
                  </LegalGate>
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
            <Route path="*" element={<SparkNotFound />} />
          </Route>
        </HubViewTransitionRoutes>
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
