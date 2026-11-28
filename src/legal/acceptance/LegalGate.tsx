import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { useThemeMode } from "@/hooks/useThemeMode";
import { holdAppearance } from "@/theme/appearance";
import { themes } from "@/theme/themes";
import { AppShellSkeleton } from "@/layout/PageSkeletons";
import { LegalClickwrap } from "./LegalClickwrap";
import {
  clearCachedLegalAcceptance,
  hasCachedLegalAcceptance,
  writeCachedLegalAcceptance,
} from "./legalAcceptanceCache";
import { useLegalGateStore } from "./legalGateStore";
import { acceptLegalTerms, fetchLegalStatus, type LegalStatus } from "./legalStatus";

type Phase = "checking" | "open" | "gate";

/**
 * Wraps every signed-in page. Admin and brand users must accept the current
 * Terms of Service + Acceptable Use Policy (and acknowledge the Privacy
 * Policy) before Spark loads; the server enforces the same thing, and any
 * call it blocks re-opens this gate (legalGateStore).
 *
 * Returning sessions with a cached acceptance for the active user render
 * `children` immediately on frame 1 while `fetchLegalStatus()` revalidates
 * once per token in the background — eliminating the serial LegalGate boot
 * barrier AND preventing a duplicate check/remount when `fetchMe()` resolves.
 */
export function LegalGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const logout = useAuthStore((s) => s.logout);
  const required = useLegalGateStore((s) => s.required);
  const clearFlag = useLegalGateStore((s) => s.clear);
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>(() =>
    !useLegalGateStore.getState().required && hasCachedLegalAcceptance(userId)
      ? "open"
      : "checking",
  );
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<LegalStatus | null> | null>(null);
  const checkedTokenRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    if (!inFlightRef.current) {
      inFlightRef.current = fetchLegalStatus().finally(() => {
        inFlightRef.current = null;
      });
    }
    const next = await inFlightRef.current;
    setStatus(next);
    if (next?.needsAcceptance) {
      clearCachedLegalAcceptance();
      setAgreed(false);
      setError(null);
      setPhase("gate");
    } else {
      const uid = useAuthStore.getState().user?.id ?? null;
      if (next && uid) {
        writeCachedLegalAcceptance(uid, next.currentVersion || "ok");
      }
      clearFlag();
      setPhase("open");
    }
  }, [clearFlag]);

  // Verify once per session token instead of re-blocking & double-fetching
  // when `user.id` hydrates from `fetchMe()`.
  useEffect(() => {
    const tokenKey = token ?? "__anon__";
    if (checkedTokenRef.current === tokenKey) return;
    checkedTokenRef.current = tokenKey;

    const currentUid = useAuthStore.getState().user?.id ?? null;
    if (useLegalGateStore.getState().required || !hasCachedLegalAcceptance(currentUid)) {
      setPhase("checking");
    }
    void check();
  }, [token, check]);

  // Persist local acceptance cache once `fetchMe()` populates `userId` on the
  // very first load (when `fetchLegalStatus` finished slightly before `fetchMe`).
  useEffect(() => {
    if (userId && status && !status.needsAcceptance && phase === "open") {
      writeCachedLegalAcceptance(userId, status.currentVersion || "ok");
    }
  }, [userId, status, phase]);

  // A data call came back LEGAL_ACCEPTANCE_REQUIRED (e.g. the version was
  // bumped mid-session): re-read the status and show the gate.
  useEffect(() => {
    if (required && phase === "open") {
      clearCachedLegalAcceptance();
      void check();
    }
  }, [required, phase, check]);

  const onContinue = useCallback(async () => {
    if (!status || !agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await acceptLegalTerms(status.currentVersion);
    setSubmitting(false);
    if (res.success) {
      const uid = useAuthStore.getState().user?.id ?? userId;
      writeCachedLegalAcceptance(
        uid,
        res.status?.currentVersion ?? status.currentVersion,
      );
      clearFlag();
      setStatus(res.status);
      setPhase("open");
      return;
    }
    if (res.code === "VERSION_MISMATCH" && res.status) {
      // The terms changed while this page was open: show the new version.
      setStatus(res.status);
      setAgreed(false);
    }
    setError(res.message || "Could not record your acceptance. Please try again.");
  }, [status, agreed, submitting, clearFlag, userId]);

  const onSignOut = useCallback(() => {
    clearCachedLegalAcceptance();
    clearFlag();
    logout();
    navigate("/login");
  }, [clearFlag, logout, navigate]);

  if (phase === "checking") return <AppShellSkeleton />;
  if (phase === "gate" && status) {
    return (
      <LegalGateScreen
        status={status}
        agreed={agreed}
        submitting={submitting}
        error={error}
        onAgreeChange={setAgreed}
        onContinue={onContinue}
        onSignOut={onSignOut}
      />
    );
  }
  return <>{children}</>;
}

function LegalGateScreen({
  status,
  ...rest
}: {
  status: LegalStatus;
  agreed: boolean;
  submitting: boolean;
  error: string | null;
  onAgreeChange: (v: boolean) => void;
  onContinue: () => void;
  onSignOut: () => void;
}) {
  // Same appearance (light / dark) as the signed-in app.
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== themes.dark) {
      root.setAttribute("data-theme", themes.dark);
    }
    return holdAppearance();
  }, []);
  const [isDark] = useThemeMode();

  return (
    <LegalClickwrap
      documents={status.documents}
      version={status.currentVersion}
      isUpdate={status.isUpdate}
      changeSummary={status.changeSummary ?? null}
      dark={isDark}
      {...rest}
    />
  );
}
