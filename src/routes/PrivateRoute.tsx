import { Navigate, useLocation } from "react-router";
import type { ReactElement } from "react";

interface PrivateRouteProps {
    component: ReactElement;
}

const PrivateRoute = ({ component }: PrivateRouteProps) => {
    let location = useLocation();
    const jwtToken = localStorage.getItem('@token');
    const isAuth = !!jwtToken;

    if (isAuth) {
        return component;
    } else
        return (
            <Navigate
                to="/login"
                state={{ from: location }}
            />
        );
}

export default PrivateRoute;