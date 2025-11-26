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

const rootPath = "/";

const AppRouter = () => (
  <BrowserRouter>
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
      {appRoutes.map((props, key) => (
        <Route
          path={props.path}
          key={key}
          element={
            props.isPublic ? (
              props.component
            ) : (
              <PrivateRoute component={props.component} />
            )
          }
        />
      ))}
    </Routes>
  </BrowserRouter>
);

const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  let location = useLocation();

  return isAuthenticated ? (
    <Navigate to={rootPath} state={{ from: location }} />
  ) : (
    children
  );
};

export default AppRouter;
