/**
 * Admin job board controls on Plans: the shareable BA link, open shifts and
 * visibility per gig, and the BAs who booked themselves (with cancel).
 *
 * Ignite staff only. The API answers `available: false` for brand users and
 * for brands without a board, and the panel then renders nothing.
 */

import { useCallback, useEffect, useState } from "react";
import SparkConfirm from "@/shared/SparkConfirm";
import { jobBoardUrl } from "@/utils/publicHosts";
import { postGql } from "./fieldMarketingGql";

type JobBoardBooking = {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  createdAt: string;
};

type JobBoardGig = {
  id: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  market: string;
  typeLabel: string;
  requestCode: string;
  requestUrl: string;
  openShifts: number;
  defaultOpenShifts: number;
  listed: boolean;
  publicNotes: string;
  booked: number;
  spotsLeft: number;
  bookings: JobBoardBooking[];
};

type JobBoardPending = {
  id: string;
  name: string;
  startsOn: string | null;
  market: string;
  requestCode: string;
  requestUrl: string;
  reason: "no_status" | "pending" | "queue" | "no_event" | "other";
  reasonLabel: string;
  actionLabel: string | null;
  openShifts: number;
};

type JobBoard = {
  available: boolean;
  token: string | null;
  gigs: JobBoardGig[];
  pending: JobBoardPending[];
};

const GIG_FIELDS = `
  id venue dateLabel timeLabel market typeLabel requestCode requestUrl
  openShifts defaultOpenShifts listed publicNotes booked spotsLeft
  bookings { id name phone email note createdAt }
`;

const BOARD_QUERY = `
  query JobBoard($tenantId: ID) {
    jobBoard(tenantId: $tenantId) {
      available token
      gigs { ${GIG_FIELDS} }
      pending { id name startsOn market requestCode requestUrl reason reasonLabel actionLabel openShifts }
    }
  }
`;

const POST_PLAN = `
  mutation PostJobBoardPlan($input: PostJobBoardPlanInput!) {
    postJobBoardPlan(input: $input) { success message }
  }
`;

const SET_GIG = `
  mutation SetJobBoardGig($input: SetJobBoardGigInput!) {
    setJobBoardGig(input: $input) { success message gig { ${GIG_FIELDS} } }
  }
`;

const CANCEL_BOOKING = `
  mutation CancelJobBoardBooking($input: CancelJobBoardBookingInput!) {
    cancelJobBoardBooking(input: $input) { success message }
  }
`;

const MUTED = "rgba(255,255,255,0.45)";
const LIME = "var(--spark-lime, #c5f546)";
const ORANGE = "var(--spark-orange, #ef5a2a)";

function startsOnLabel(iso: string | null): string {
  if (!iso) return "Date TBD";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ShiftsInput({
  gig,
  busy,
  onSave,
}: {
  gig: JobBoardGig;
  busy: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(gig.openShifts));
  useEffect(() => setDraft(String(gig.openShifts)), [gig.openShifts]);
  const commit = () => {
    const value = Number.parseInt(draft, 10);
    if (!Number.isFinite(value) || value < 0) {
      setDraft(String(gig.openShifts));
      return;
    }
    if (value !== gig.openShifts) onSave(Math.min(value, 50));
  };
  return (
    <input
      type="number"
      min={0}
      max={50}
      inputMode="numeric"
      aria-label={`Open shifts for ${gig.venue}`}
      className="input input-bordered input-sm w-16 text-center mono"
      value={draft}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function PublicNotesInput({
  gig,
  busy,
  onSave,
}: {
  gig: JobBoardGig;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(gig.publicNotes);
  useEffect(() => setDraft(gig.publicNotes), [gig.publicNotes]);
  return (
    <label className="block text-xs space-y-1" style={{ color: MUTED }}>
      <span>Public gig notes · BAs see these on the board and in their booking email</span>
      <textarea
        rows={2}
        maxLength={2000}
        aria-label={`Public gig notes for ${gig.venue}`}
        className="textarea textarea-bordered textarea-sm w-full text-sm"
        placeholder="Optional. e.g. Park in lot C, wear black. Plan and request notes stay internal."
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== gig.publicNotes) onSave(draft.trim());
        }}
      />
    </label>
  );
}

export default function JobBoardPanel({ tenantId }: { tenantId: string | null | undefined }) {
  const [board, setBoard] = useState<JobBoard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyGig, setBusyGig] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState<{ gig: JobBoardGig; booking: JobBoardBooking } | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [approving, setApproving] = useState<JobBoardPending | null>(null);
  const [postingPlan, setPostingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await postGql<{ jobBoard: JobBoard }>(BOARD_QUERY, { tenantId });
      setBoard(data.jobBoard);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the job board.");
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!board?.available || !board.token) {
    return error ? (
      <p className="text-sm" role="alert" style={{ color: ORANGE }}>
        {error}
      </p>
    ) : null;
  }

  const link = jobBoardUrl(board.token);

  const replaceGig = (gig: JobBoardGig) =>
    setBoard((prev) => (prev ? { ...prev, gigs: prev.gigs.map((g) => (g.id === gig.id ? gig : g)) } : prev));

  const saveGig = async (
    gig: JobBoardGig,
    patch: { openShifts?: number; listed?: boolean; publicNotes?: string },
  ) => {
    setBusyGig(gig.id);
    setNotice("");
    try {
      const data = await postGql<{ setJobBoardGig: { gig: JobBoardGig } }>(SET_GIG, {
        input: { tenantId, gigId: gig.id, ...patch },
      });
      replaceGig(data.setJobBoardGig.gig);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that gig.");
    } finally {
      setBusyGig(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it.");
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const data = await postGql<{ cancelJobBoardBooking: { message: string } }>(CANCEL_BOOKING, {
        input: { tenantId, bookingId: cancelling.booking.id },
      });
      setNotice(data.cancelJobBoardBooking.message);
      setCancelling(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel that booking.");
    } finally {
      setCancelBusy(false);
    }
  };

  const postPlan = async (plan: JobBoardPending) => {
    setPostingPlan(plan.id);
    setNotice("");
    try {
      const data = await postGql<{ postJobBoardPlan: { message: string } }>(POST_PLAN, {
        input: { tenantId, planId: plan.id },
      });
      setNotice(data.postJobBoardPlan.message);
      setApproving(null);
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't put that plan on the board.");
    } finally {
      setPostingPlan(null);
    }
  };

  const onPlanAction = (plan: JobBoardPending) => {
    if (plan.reason === "no_event") void postPlan(plan);
    else setApproving(plan);
  };

  const liveGigs = board.gigs.filter((g) => g.listed && g.openShifts > 0);

  return (
    <section className="spark-card p-5 space-y-4" aria-labelledby="job-board-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: MUTED }}>
            JOB BOARD · BA SIGN-UPS
          </p>
          <h2 id="job-board-title" className="spark-title text-lg mt-1">
            {liveGigs.length} gig{liveGigs.length === 1 ? "" : "s"} on the board
          </h2>
          <p className="spark-support text-sm mt-1">
            Share this link with BAs. They pick gigs, leave name, cell, and email, and get booked on the spot.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          aria-label="Job board link"
          className="input input-bordered input-sm mono flex-1 min-w-[240px]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn btn-sm btn-ghost" href={link} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>

      {error ? (
        <p className="text-sm" role="alert" style={{ color: ORANGE }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm" style={{ color: LIME }}>
          {notice}
        </p>
      ) : null}

      {board.gigs.length === 0 ? (
        <p className="spark-support text-sm">
          No upcoming plan gigs yet. A staffed plan lists here once its request is approved.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {board.gigs.map((gig) => {
            const busy = busyGig === gig.id;
            const full = gig.spotsLeft <= 0 && gig.openShifts > 0;
            return (
              <li key={gig.id} className="py-3 space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[220px] flex-1">
                    <p className="font-semibold text-sm">
                      {gig.dateLabel} · <span style={{ color: MUTED }}>{gig.timeLabel}</span>
                    </p>
                    <p className="text-sm">{gig.venue}</p>
                    <p className="mono text-[10px] mt-0.5" style={{ letterSpacing: "0.12em", color: MUTED }}>
                      {[gig.market, gig.typeLabel].filter(Boolean).join(" · ").toUpperCase()} ·{" "}
                      <a href={gig.requestUrl} className="underline">
                        {gig.requestCode}
                      </a>
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                    Open shifts
                    <ShiftsInput gig={gig} busy={busy} onSave={(value) => void saveGig(gig, { openShifts: value })} />
                  </label>
                  <span
                    className="mono text-[11px] px-2 py-1 rounded"
                    style={{
                      background: full ? "rgba(239,90,42,0.14)" : "rgba(197,245,70,0.12)",
                      color: full ? ORANGE : LIME,
                    }}
                  >
                    {gig.booked} booked · {full ? "FULL" : `${gig.spotsLeft} open`}
                  </span>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-success"
                      checked={gig.listed}
                      disabled={busy}
                      onChange={(e) => void saveGig(gig, { listed: e.target.checked })}
                    />
                    Show on job board
                  </label>
                </div>
                <PublicNotesInput
                  gig={gig}
                  busy={busy}
                  onSave={(value) => void saveGig(gig, { publicNotes: value })}
                />
                {gig.bookings.length ? (
                  <ul className="space-y-1 pl-3" style={{ borderLeft: "2px solid rgba(197,245,70,0.35)" }}>
                    {gig.bookings.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold">{b.name}</span>
                        <a href={`tel:${b.phone.replace(/\D/g, "")}`} className="mono text-xs" style={{ color: MUTED }}>
                          {b.phone}
                        </a>
                        <a href={`mailto:${b.email}`} className="text-xs" style={{ color: MUTED }}>
                          {b.email}
                        </a>
                        {b.note ? (
                          <span className="text-xs italic" style={{ color: MUTED }}>
                            “{b.note}”
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs ml-auto"
                          style={{ color: ORANGE }}
                          onClick={() => setCancelling({ gig, booking: b })}
                        >
                          Cancel booking
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {board.pending.length ? (
        <div className="space-y-2">
          <div>
            <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: MUTED }}>
              NOT ON THE BOARD YET
            </p>
            <p className="spark-support text-xs mt-1">
              A plan lists once its request is approved. Approve it here and it goes up with the plan's BA count as open
              shifts.
            </p>
          </div>
          <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {board.pending.map((p) => (
              <li
                key={p.id}
                className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm">
                    {startsOnLabel(p.startsOn)} · {p.name}
                  </p>
                  <p className="mono text-[10px] mt-0.5" style={{ letterSpacing: "0.12em", color: MUTED }}>
                    {[p.market, `${p.openShifts} BA${p.openShifts === 1 ? "" : "s"}`].filter(Boolean).join(" · ").toUpperCase()}{" "}
                    ·{" "}
                    <a href={p.requestUrl} className="underline">
                      {p.requestCode}
                    </a>
                  </p>
                </div>
                <span className="text-xs" style={{ color: p.actionLabel ? ORANGE : MUTED }}>
                  {p.reasonLabel}
                </span>
                {p.actionLabel ? (
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    disabled={postingPlan === p.id}
                    onClick={() => onPlanAction(p)}
                  >
                    {postingPlan === p.id ? "Posting…" : p.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {approving ? (
        <SparkConfirm
          kicker="Approve & post"
          title={`Approve ${approving.name}?`}
          body={`This approves ${approving.requestCode} the same way Approvals does: the submitter gets the usual approval email. It then goes on the job board with ${approving.openShifts} open shift${approving.openShifts === 1 ? "" : "s"}.`}
          confirmLabel="Approve & post"
          cancelLabel="Not yet"
          busy={postingPlan === approving.id}
          onConfirm={() => void postPlan(approving)}
          onCancel={() => setApproving(null)}
        />
      ) : null}

      {cancelling ? (
        <SparkConfirm
          tone="danger"
          kicker="Cancel booking"
          title={`Cancel ${cancelling.booking.name}?`}
          body={`They come off ${cancelling.gig.venue} (${cancelling.gig.dateLabel}), the spot reopens on the board, and they get a short cancellation email.`}
          confirmLabel="Cancel booking"
          cancelLabel="Keep"
          busy={cancelBusy}
          onConfirm={() => void confirmCancel()}
          onCancel={() => setCancelling(null)}
        />
      ) : null}
    </section>
  );
}
