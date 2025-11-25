import { useGoogleLogin } from "@react-oauth/google";
import { useAlertStore } from "@store/alertStore";
import { useAuthStore } from '@store/authStore';
import { useNavigate } from "react-router";
import { useState } from "react";

interface GoogleButtonProps {
    isLogin?: boolean;
}

export const SOCIAL_AUTH_GOOGLE = `
  mutation SocialAuthGoogle($input:GoogleSocialAuthInput!) {
    socialAuthGoogle(input:$input) {
      success
      token
      message
      refreshToken
    }
  }
`;

export const GoogleButton: React.FC<GoogleButtonProps> = ({ isLogin = true }) => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showAlert } = useAlertStore();
    const { socialLogin } = useAuthStore();

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setLoading(true);

                const accessToken = tokenResponse.access_token;

                const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: SOCIAL_AUTH_GOOGLE,
                        variables: {
                            input: {
                                accessToken
                            }
                        },
                    }),
                });

                const result = await res.json();
                if (result.data?.socialAuthGoogle?.success) {
                    console.log("result", result);
                    const { token, refreshToken } = result.data.socialAuthGoogle;
                    socialLogin(token, refreshToken)
                    console.log("token", token);
                    console.log("refreshToken", refreshToken);
                    showAlert("Login successful", "success");
                    navigate("/")
                } else {
                    showAlert(result.data?.socialAuthGoogle?.message, "error")
                    console.error("Auth failed:", result.data?.socialAuthGoogle?.message);
                }
            } catch (err) {
                console.error("Google login error:", err);
            } finally {
                setLoading(false);
            }
        },
        onError: () => console.error("Google login failed"),
    });

    return (
        <button
            type="button"
            className={`w-full border border-base-300 rounded-full py-3 flex items-center justify-center gap-2 text-base-content hover:bg-base-200 transition ${loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
            onClick={() => !loading && login()}
            disabled={loading}
        >
            <svg
                aria-label="Google logo"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
            >
                <g>
                    <path d="m0 0H512V512H0" fill="#fff"></path>
                    <path
                        fill="#34a853"
                        d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
                    ></path>
                    <path
                        fill="#4285f4"
                        d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"
                    ></path>
                    <path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"></path>
                    <path
                        fill="#ea4335"
                        d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
                    ></path>
                </g>
            </svg>
            {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
            ) : (
                <span>{isLogin ? "Sign in with Google" : "Sign up with Google"}</span>
            )}
        </button>
    );
};