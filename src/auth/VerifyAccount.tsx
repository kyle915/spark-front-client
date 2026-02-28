import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import bgImage from "@/assets/background.png";
import { verifyAccount } from "@/api/auth/verifyAccount";
import Loading from "@/shared/Loading";

type VerifyStatus = "pending" | "success" | "error";

const isMobileDevice = () => {
    const userAgentData = (navigator as Navigator & {
        userAgentData?: { mobile?: boolean };
    }).userAgentData;
    if (typeof userAgentData?.mobile === "boolean") return userAgentData.mobile;

    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const VerifyAccount = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<VerifyStatus>("pending");
    const [message, setMessage] = useState("Verifying your account...");

    useEffect(() => {
        const token = searchParams.get("token");

        if (!token) {
            setStatus("error");
            setMessage("Verification token is missing in the link.");
            return;
        }

        verifyAccount(token)
            .then(() => {
                setStatus("success");
                setMessage("Your account has been verified successfully.");
            })
            .catch((error) => {
                const errorMessage = error instanceof Error ? error.message : "Could not verify the account.";
                setStatus("error");
                setMessage(errorMessage);
            });
    }, [searchParams]);

    const handleGoToLogin = () => {
        const mobileLoginUrl = import.meta.env.VITE_MOBILE_LOGIN_URL as string | undefined;

        if (isMobileDevice() && mobileLoginUrl) {
            window.location.href = mobileLoginUrl;
            return;
        }

        window.location.href = "/login";
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4"
            style={{ backgroundImage: `url(${bgImage})` }}
        >
            <div className="w-full max-w-lg bg-base-100 shadow-2xl rounded-3xl p-10 text-center space-y-6">
                <div className="space-y-2">
                    <p className="text-3xl font-bold text-base-content">Account verification</p>
                    <p className="text-base-content/70">{message}</p>
                </div>

                {status === "pending" ? (
                    <Loading />
                ) : (
                    <div
                        className={`px-4 py-3 rounded-xl ${
                            status === "success" ? "bg-success/10 text-success" : "bg-error/10 text-error"
                        }`}
                    >
                        {status === "success" ? "All set" : "There was a problem"}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleGoToLogin}
                    className="btn btn-primary w-full"
                >
                    Go to login
                </button>
            </div>
        </div>
    );
};

export default VerifyAccount;
