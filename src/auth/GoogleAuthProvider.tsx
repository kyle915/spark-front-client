import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

interface Props {
    children: React.ReactNode;
}

export const GoogleAuthProvider: React.FC<Props> = ({ children }) => {
    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID!}>
            {children}
        </GoogleOAuthProvider>
    );
};