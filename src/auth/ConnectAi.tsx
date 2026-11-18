import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuthStore } from "@store/authStore";
import { GoogleButton } from "@auth/components/GoogleButton";
import { AuthShell } from "./AuthShell";
import { failureMessage } from "./authCopy";

/**
 * "Continue with Google" for the AI connection page (Claude, ChatGPT, ...).
 *
 * That page lives on the API and can't run Google sign-in itself, so it sends
 * people here with a one-time code (?h=). We sign them in with the normal
 * Google button, they confirm, and approveAiSignIn returns the address to go
 * back to. That address comes from the server; we never follow one from the
 * link. The code only finishes in the browser that started, once, within
 * 10 minutes (checked by the API).
 */

const STORAGE_KEY = "spark.connectAi.handoff";

const APPROVE_AI_SIGN_IN = `
  mutation ApproveAiSignIn($handoff: String!) {
    approveAiSignIn(handoff: $handoff) {
      ok
      message
      returnUrl
    }
  }
`;

type ApproveResult = { ok: boolean; message: string; returnUrl: string | null };

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(value: string | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the code stays in memory for this visit */
  }
}

/** Only follow an absolute http(s) address; anything else is refused. */
function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.pathname !== "/oauth/authorize/google") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function approve(handoff: string, token: string): Promise<ApproveResult> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({ query: APPROVE_AI_SIGN_IN, variables: { handoff } }),
  });
  const json = (await res.json().catch(() => null)) as {
    data?: { approveAiSignIn?: ApproveResult | null } | null;
    errors?: Array<{ message: string }>;
  } | null;
  const result = json?.data?.approveAiSignIn;
  if (!res.ok || !result) {
    throw new Error(json?.errors?.[0]?.message || "Couldn't reach Spark. Try again in a moment.");
  }
  return result;
}

export default function ConnectAi() {
  const [search, setSearch] = useSearchParams();
  const { isAuthenticated, user, token, logout, loadFromStorage } = useAuthStore();
  const [handoff, setHandoff] = useState<string | null>(() => search.get("h") || readStored());
  const [checking, setChecking] = useState(() => {
    try {
      return Boolean(localStorage.getItem("@token"));
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Keep the code out of the address bar and history.
  useEffect(() => {
    const fromUrl = search.get("h");
    if (fromUrl) {
      store(fromUrl);
      setHandoff(fromUrl);
      setSearch({}, { replace: true });
    }
  }, [search, setSearch]);

  // Wait for a saved Spark sign-in to load before offering Google.
  useEffect(() => {
    if (!checking || isAuthenticated) {
      setChecking(false);
      return;
    }
    let live = true;
    void Promise.resolve(loadFromStorage()).finally(() => {
      if (live) setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [checking, isAuthenticated, loadFromStorage]);

  const proceed = async () => {
    const current = useAuthStore.getState().token || token;
    if (!handoff || !current || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await approve(handoff, current);
      const next = result.ok ? safeReturnUrl(result.returnUrl) : null;
      if (next) {
        store(null);
        window.location.assign(next);
        return;
      }
      if (result.ok) {
        setProblem("Spark sent back an address it shouldn't have, so we stopped here.");
      } else {
        store(null);
        setHandoff(null);
        setProblem(result.message);
      }
    } catch (e) {
      setProblem(failureMessage(e, "That didn't work. Try again from your AI app."));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!handoff) {
    body = (
      <>
        <h1 className="signin-title">Connect an AI app</h1>
        {problem ? (
          <p className="signin-error" role="alert">
            {problem}
          </p>
        ) : null}
        <p className="signin-lede">
          This page finishes connecting Claude, ChatGPT or another AI app to Spark. Start again
          from your AI app: open its connector settings and choose Connect.
        </p>
      </>
    );
  } else if (checking) {
    body = (
      <>
        <h1 className="signin-title">Connect an AI app</h1>
        <p className="signin-lede" role="status">
          Checking your sign-in.
        </p>
      </>
    );
  } else if (!isAuthenticated) {
    body = (
      <>
        <h1 className="signin-title">Sign in to connect your AI app</h1>
        <p className="signin-lede">
          Sign in to Spark with Google. Then you'll go back to pick the brand your AI app can read.
        </p>
        {problem ? (
          <p className="signin-error" role="alert">
            {problem}
          </p>
        ) : null}
        <div className="signin-google">
          <GoogleButton isLogin onSignedIn={() => setProblem(null)} />
        </div>
        <p className="signin-note">
          Use a password or an email link instead? Go back to the AI app's Spark page and choose it
          there.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="signin-title">Connect your AI app?</h1>
        <p className="signin-lede">
          You're signed in to Spark as <strong>{user?.email ?? "this account"}</strong>.
        </p>
        <p className="signin-note">
          Only continue if you started connecting an AI app, like Claude or ChatGPT, in the last few
          minutes. You'll pick the brand next.
        </p>
        {problem ? (
          <p className="signin-error" role="alert">
            {problem}
          </p>
        ) : null}
        <button type="button" className="signin-primary" disabled={busy} onClick={proceed}>
          {busy ? "Continuing…" : "Continue"}
        </button>
        <button
          type="button"
          className="signin-link signin-center"
          onClick={() => {
            setProblem(null);
            logout();
          }}
        >
          Use a different account
        </button>
      </>
    );
  }

  return (
    <AuthShell>
      <div className="signin-form">{body}</div>
    </AuthShell>
  );
}
