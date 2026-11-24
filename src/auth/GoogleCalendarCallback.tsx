import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useMutation } from "react-relay/hooks";
import { GoogleCalendarCallbackMutation } from "@api/mutations/GoogleCalendarCallbackMutation";
import type { GoogleCalendarCallbackMutation as GoogleCalendarCallbackMutationType } from "@api/mutations/__generated__/GoogleCalendarCallbackMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import Loading from "@shared/Loading";

const STATE_STORAGE_KEY = "google_calendar_oauth_state";

const GoogleCalendarCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showAlert } = useAlertStore();
    const [commitCallback, isInFlight] = useMutation<GoogleCalendarCallbackMutationType>(GoogleCalendarCallbackMutation);
    const [isProcessing, setIsProcessing] = useState(true);
    const hasProcessed = useRef(false); // Prevent double execution

    useEffect(() => {
        // Prevent double execution in React StrictMode
        if (hasProcessed.current) {
            return;
        }

        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const storedState = sessionStorage.getItem(STATE_STORAGE_KEY);

        // Validate that we have required parameters
        if (!code || !state) {
            hasProcessed.current = true;
            showAlert("Missing authorization code or state parameter", "error");
            sessionStorage.removeItem(STATE_STORAGE_KEY);
            navigate("/settings/calendar", { replace: true });
            setIsProcessing(false);
            return;
        }

        // Validate state matches stored value (CSRF protection)
        if (!storedState || state !== storedState) {
            hasProcessed.current = true;
            showAlert("Invalid state parameter. Please try connecting again.", "error");
            sessionStorage.removeItem(STATE_STORAGE_KEY);
            navigate("/settings/calendar", { replace: true });
            setIsProcessing(false);
            return;
        }

        // Mark as processed before making the mutation
        hasProcessed.current = true;

        // Clear state from storage
        sessionStorage.removeItem(STATE_STORAGE_KEY);

        // Call the callback mutation
        commitCallback({
            variables: {
                input: {
                    code,
                    state,
                },
            },
            onCompleted: (response) => {
                const result = response.googleCalendarCallback;
                if (result?.success) {
                    showAlert(result.message || "Google Calendar connected successfully", "success");
                    // Clean up URL parameters
                    navigate("/settings/calendar", { replace: true });
                } else {
                    showAlert(result?.message || "Failed to connect Google Calendar", "error");
                    navigate("/settings/calendar", { replace: true });
                }
                setIsProcessing(false);
            },
            onError: (error) => {
                showAlert(`Error connecting Google Calendar: ${error.message}`, "error");
                navigate("/settings/calendar", { replace: true });
                setIsProcessing(false);
            },
        });
    }, [searchParams, navigate, showAlert, commitCallback]);

    if (isProcessing || isInFlight) {
        return <Loading />;
    }

    return null;
};

export default GoogleCalendarCallback;

