import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { verifyAccount } from "@/api/auth/verifyAccount";
import { AuthShell } from "./AuthShell";
import { failureMessage } from "./authCopy";

type VerifyStatus = "pending" | "success" | "error";

const VerifyAccount = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<VerifyStatus>("pending");
    const [message, setMessage] = useState("Checking your link.");

    useEffect(() => {
        const token = searchParams.get("token");

        if (!token) {
            setStatus("error");
            setMessage("This link is incomplete. Open the link from your email again.");
            return;
        }

        verifyAccount(token)
            .then(() => {
                setStatus("success");
                setMessage("Your account is verified. You can sign in now.");
            })
            .catch((error) => {
                setStatus("error");
                setMessage(failureMessage(error, "Could not verify your account."));
            });
    }, [searchParams]);

    const handleGoToLogin = () => {
        const mobileLoginUrl = import.meta.env.VITE_MOBILE_LOGIN_URL as string;
        window.location.href = mobileLoginUrl;
    };

    const title =
        status === "pending"
            ? "Verifying your account"
            : status === "success"
              ? "Account verified"
              : "We could not verify your account";

    return (
        <AuthShell>
            <div className="signin-form">
                <h1 className="signin-title">{title}</h1>
                {status === "error" ? (
                    <p className="signin-error" role="alert">
                        {message}
                    </p>
                ) : (
                    <p className={status === "success" ? "signin-note" : "signin-lede"} role="status">
                        {message}
                    </p>
                )}
                <button type="button" className="signin-primary" onClick={handleGoToLogin}>
                    Go to sign in
                </button>
            </div>
        </AuthShell>
    );
};

export default VerifyAccount;
