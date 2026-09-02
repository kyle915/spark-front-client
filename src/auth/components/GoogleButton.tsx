import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAlertStore } from "@store/alertStore";
import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router";
import { useState } from "react";

interface GoogleButtonProps {
  isLogin?: boolean;
}

export const SOCIAL_AUTH_GOOGLE = `
  mutation SocialAuthGoogle($input: GoogleSocialAuthInput!) {
    socialAuthGoogle(input: $input) {
      success
      token
      message
      refreshToken
    }
  }
`;

/**
 * Sign in with Google via GIS credential (id_token), not the legacy
 * implicit access_token popup. The popup flow silently fails in modern
 * Chrome when postMessage / FedCM breaks — everyone sees a dead button.
 */
export const GoogleButton: React.FC<GoogleButtonProps> = ({
  isLogin = true,
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const { socialLogin } = useAuthStore();

  const exchangeCredential = async (credential: string) => {
    setLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: SOCIAL_AUTH_GOOGLE,
          variables: {
            input: {
              idToken: credential,
            },
          },
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        showAlert("Couldn't reach Spark. Try again in a moment.", "error");
        return;
      }
      if (result?.errors?.length) {
        showAlert(
          result.errors[0]?.message || "Google sign-in failed.",
          "error",
        );
        return;
      }
      const payload = result?.data?.socialAuthGoogle;
      if (payload?.success && payload.token) {
        await socialLogin(payload.token, payload.refreshToken);
        showAlert("Login successful", "success");
        navigate("/");
        return;
      }
      showAlert(
        payload?.message ||
          "Google sign-in failed. If this keeps happening, use email + password or a magic link.",
        "error",
      );
    } catch (err) {
      console.error("Google login error:", err);
      showAlert("Google sign-in failed. Check your connection and try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const onSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      showAlert("Google didn't return a sign-in credential. Try again.", "error");
      return;
    }
    void exchangeCredential(response.credential);
  };

  return (
    <div
      className={`w-full flex justify-center ${loading ? "opacity-50 pointer-events-none" : ""}`}
      aria-busy={loading}
    >
      <GoogleLogin
        onSuccess={onSuccess}
        onError={() =>
          showAlert(
            "Google sign-in was cancelled or blocked by the browser.",
            "error",
          )
        }
        useOneTap={false}
        theme="outline"
        size="large"
        shape="pill"
        text={isLogin ? "signin_with" : "signup_with"}
        width="100%"
        logo_alignment="left"
      />
    </div>
  );
};
