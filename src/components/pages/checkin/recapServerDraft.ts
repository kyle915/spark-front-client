/**
 * Server copy of a walk-up recap draft.
 *
 * This is not a submit. The path is `/recap-draft`, and the body never
 * carries approval, a submit flag, or the filed-recap photo list. The API
 * stores it beside the shift and leaves approved / submitted_at alone.
 */
import type { DraftScope, RecapDraft } from "./recapDraft";

export type RecapDraftRequest = {
  path: string;
  body: {
    session: string;
    scope: DraftScope;
    draft: RecapDraft;
    /** The form these answers belong to; a stale tab's save is refused
     *  after the BA switched program. */
    templateId?: string;
  };
};

export function recapDraftPath(code: string): string {
  return `/api/public/checkin/${encodeURIComponent(code)}/recap-draft`;
}

export function buildRecapDraftRequest(opts: {
  code: string;
  session: string;
  scope: DraftScope;
  draft: RecapDraft;
  templateId?: string;
}): RecapDraftRequest {
  const { photos, ...rest } = opts.draft;
  const draft: RecapDraft = photos ? { ...rest, photos } : rest;
  return {
    path: recapDraftPath(opts.code),
    body: {
      session: opts.session,
      scope: opts.scope,
      draft,
      ...(opts.templateId ? { templateId: opts.templateId } : {}),
    },
  };
}

/**
 * True only for the filing endpoint. `/recap-draft` must stay false —
 * a draft save is not a submit.
 */
export function requestFilesRecap(path: string): boolean {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  return clean.endsWith("/recap");
}
