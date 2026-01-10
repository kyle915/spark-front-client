import { useEffect } from "react";
import Alert from "@/shared/Alert";
import AppRouter from "@routes/AppRouter";
import { GoogleAuthProvider } from "@auth/GoogleAuthProvider";
import { useAuthStore } from '@store/authStore';
import { RelayEnvironmentProvider } from "react-relay";
import environment from "@api/relay/environment";

export default function App() {
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <RelayEnvironmentProvider environment={environment}>
      <GoogleAuthProvider>
        <AppRouter />
        <Alert />
      </GoogleAuthProvider>
    </RelayEnvironmentProvider>
  );
}