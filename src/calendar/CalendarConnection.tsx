import { useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useMutation, useLazyLoadQuery } from "react-relay/hooks";
import { ConnectGoogleCalendarMutation } from "@/api/mutations/ConnectGoogleCalendarMutation";
import { DisconnectGoogleCalendarMutation } from "@/api/mutations/DisconnectGoogleCalendarMutation";
import { GoogleCalendarConnectionStatusQuery } from "@/api/queries/GoogleCalendarConnectionStatusQuery";
import type { ConnectGoogleCalendarMutation as ConnectGoogleCalendarMutationType } from "@api/mutations/__generated__/ConnectGoogleCalendarMutation.graphql";
import type { DisconnectGoogleCalendarMutation as DisconnectGoogleCalendarMutationType } from "@api/mutations/__generated__/DisconnectGoogleCalendarMutation.graphql";
import type { GoogleCalendarConnectionStatusQuery as GoogleCalendarConnectionStatusQueryType } from "@api/queries/__generated__/GoogleCalendarConnectionStatusQuery.graphql";
import { useAlertStore } from "@store/alertStore";
import Loading from "@shared/Loading";
import { Calendar } from "lucide-react";

const STATE_STORAGE_KEY = "google_calendar_oauth_state";

type CalendarConnectionInnerProps = {
  onRefresh: () => void;
};

const CalendarConnectionInner = ({
  onRefresh,
}: CalendarConnectionInnerProps) => {
  const [commitConnect, isConnecting] =
    useMutation<ConnectGoogleCalendarMutationType>(
      ConnectGoogleCalendarMutation
    );
  const [commitDisconnect, isDisconnecting] =
    useMutation<DisconnectGoogleCalendarMutationType>(
      DisconnectGoogleCalendarMutation
    );
  const { showAlert } = useAlertStore();

  const statusData = useLazyLoadQuery<GoogleCalendarConnectionStatusQueryType>(
    GoogleCalendarConnectionStatusQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const connectionStatus = statusData.googleCalendarConnectionStatus;

  const handleConnect = () => {
    commitConnect({
      variables: {
        input: {},
      },
      onCompleted: (response) => {
        const result = response.connectGoogleCalendar;
        if (result?.success && result?.authorizationUrl && result?.state) {
          // Store state for CSRF protection
          sessionStorage.setItem(STATE_STORAGE_KEY, result.state);
          // Redirect to Google OAuth page
          window.location.href = result.authorizationUrl;
        } else {
          showAlert(
            result?.message || "Failed to initiate Google Calendar connection",
            "error"
          );
          // Refresh status to update UI
          onRefresh();
        }
      },
      onError: (error) => {
        showAlert(
          `Error connecting to Google Calendar: ${error.message}`,
          "error"
        );
        // Refresh status to update UI
        onRefresh();
      },
    });
  };

  const handleDisconnect = () => {
    commitDisconnect({
      variables: {
        input: {},
      },
      onCompleted: (response) => {
        const result = response.disconnectGoogleCalendar;
        if (result?.success) {
          showAlert(
            result.message || "Google Calendar disconnected successfully",
            "success"
          );
          // Refresh status to update UI
          onRefresh();
        } else {
          showAlert(
            result?.message || "Failed to disconnect Google Calendar",
            "error"
          );
          // Refresh status to update UI
          onRefresh();
        }
      },
      onError: (error) => {
        showAlert(
          `Error disconnecting Google Calendar: ${error.message}`,
          "error"
        );
        // Refresh status to update UI
        onRefresh();
      },
    });
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const isLoading = isConnecting || isDisconnecting;
  const isConnected = connectionStatus.isConnected;
  const isActive = connectionStatus.isActive;

  // Format connected date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Layout>
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-xl font-semibold">
                Google Calendar Integration
              </h1>
              <p className="text-sm text-base-content/60">
                Sync Spark events with your Google Calendar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn btn-sm btn-ghost"
          >
            <span className="loading loading-spinner loading-xs hidden" />
            Refresh
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between bg-base-200 rounded-xl p-4">
            <div>
              <p className="text-sm font-medium">Connection status</p>
              <p className="text-xs text-base-content/60">
                Authorization and token health
              </p>
            </div>

            {isConnected && isActive ? (
              <span className="badge badge-success badge-outline">
                Connected
              </span>
            ) : isConnected && !isActive ? (
              <span className="badge badge-warning badge-outline">
                Action required
              </span>
            ) : (
              <span className="badge badge-ghost">Not connected</span>
            )}
          </div>

          {/* Alerts only when needed */}
          {isConnected && !isActive && (
            <div className="alert alert-warning text-sm">
              Your Google Calendar connection exists but is no longer active.
              Please reconnect to restore synchronization.
            </div>
          )}

          {!isConnected && (
            <div className="alert alert-info text-sm text-white">
              Connect your Google Calendar to automatically sync events created
              in Spark.
            </div>
          )}

          {/* Metadata */}
          {isConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {connectionStatus.calendarId && (
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-base-content/50">
                    Calendar ID
                  </span>
                  <span className="font-medium">
                    {connectionStatus.calendarId}
                  </span>
                </div>
              )}

              {connectionStatus.connectedAt && (
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-base-content/50">
                    Connected at
                  </span>
                  <span className="font-medium">
                    {formatDate(connectionStatus.connectedAt)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-5 border-t border-base-300 flex justify-end">
          {isConnected && isActive ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isLoading}
              className="btn btn-outline btn-error rounded-full"
            >
              {isDisconnecting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Disconnecting…
                </>
              ) : (
                "Disconnect"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isLoading}
              className="btn btn-primary rounded-full"
            >
              <Calendar className="w-4 h-4" />
              {isConnecting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Connecting…
                </>
              ) : isConnected && !isActive ? (
                "Reconnect Google Calendar"
              ) : (
                "Connect Google Calendar"
              )}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
};

const CalendarConnection = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <Suspense fallback={<Loading />} key={refreshKey}>
      <CalendarConnectionInner onRefresh={handleRefresh} />
    </Suspense>
  );
};

export default CalendarConnection;
