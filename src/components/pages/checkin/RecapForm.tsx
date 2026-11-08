import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { isExpenseReceiptBucket } from "./photoBuckets";
import { advisoryFromPhotoCheck, requestPhotoCheck, sha256Hex } from "./photoCheck";
import { applyVoiceFills, type VoiceFill } from "./voiceDraft";
import { VoiceRecapCard } from "./VoiceRecapCard";
import { PHOTO_CAP } from "./photoCap";
import {
  AUTO_RETRY_DELAYS_MS,
  UNREADABLE_PHOTO_MESSAGE,
  apiOrigin,
  choiceKind,
  compressImage,
  draftPhotoOf,
  fileIsReadable,
  fmtDay,
  isPhotoType,
  photoPrep,
  photoUploads,
  postCheckinClock,
  postCheckinPayableMileage,
  postCheckinRecap,
  retryableUploadFailure,
} from "./checkinHelpers";
import {
  stalledUploadingCount,
  uploadStallMessage,
} from "./uploadStall";
import type {
  Photo,
  PhotoBucket,
  StoreIdentity,
  Template,
  TemplateField,
  TemplateProduct,
} from "./checkinTypes";
import {
  card,
  errText,
  h2,
  input,
  label,
  primaryBtn,
  secondaryBtn,
} from "./checkinStyles";
import { CorpoCardYesNo, PhotoBucketZone, PhotoFileInputs, PhotoGrid } from "./RecapPhotoStep";
import {
  engagementsFromSamplesGiven,
  templateHasConsumersSampledField,
} from "@/recap/engagementsFromSamples";
import {
  DropOffLocationsField,
} from "@/recap/DropOffLocationsField";
import {
  isDropOffLocationsField,
  parseDropOffLocations,
  productSamplesFromDropOffs,
  validateDropOffLocationsValue,
} from "@/recap/dropOffLocations";
import {
  isProductsSampledMultiselect,
  matchProductForSampleOption,
  productSampleQtyHelper,
  productSampleQtyUnit,
  productSamplesFromSelections,
} from "@/recap/productsSampledQty";
import { SpendAmountInput } from "@/recap/SpendAmountInput";
import {
  isSpendAmountField,
  spendAmountError,
  spendAmountStored,
} from "@/recap/spendAmount";
import { makeThumbnail } from "@/utils/compressImageForUpload";
import {
  deleteDraftPhotoFiles,
  loadDraftPhotos,
  saveDraftPhotoFile,
  writeDraftPhotos,
} from "./photoDraft";
import {
  asRecapDraft,
  clearDraft,
  draftSavedLabel,
  pickRestoredDraft,
  readDraft,
  writeDraft,
  type DraftScope,
  type RecapDraft,
  type StoreIdentityDraft,
} from "./recapDraft";
import { buildRecapDraftRequest } from "./recapServerDraft";
import { buildCompletenessItems } from "./checkinCompleteness";
import { PhotoQualityWarnings, RecapCompletenessChecklist } from "./RecapCompleteness";
import {
  analyzePhotoFile,
  classifyPhotoQuality,
  qualityMessage,
  quickPhotoHash,
  type PhotoQualityWarning,
} from "./photoQuality";
import { browserPlayableContentType } from "@/utils/recapFileUrl";
import {
  computeUploadProgress,
  formatUploadProgress,
} from "./uploadProgress";
import {
  flushPendingClock,
  isOfflineClockFailure,
  offlineClockBanner,
  readPendingClock,
} from "./offlineClock";
import {
  enqueueRecap,
  offlineRecapBanner,
  putCheckinPhoto,
  NO_SIGNAL_PHOTO_MESSAGE,
  readPendingRecap,
} from "./offlineRecap";
import {
  flushPendingMileage,
  offlineMileageBanner,
  readPendingMileage,
} from "./offlineMileage";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { holdActionSuccess, type ActionPhase } from "@/motion/opsMotion";
import { useCoBrandRecap, type CoBrandOptions } from "./coBrandRecap";
import { CoBrandSections, CoBrandToggleCard } from "./CoBrandRecapCards";
import { isFieldShown, withoutHiddenValues } from "./fieldConditions";
import {
  formatPayableMiles,
  isMileageCustomFieldName,
} from "./payableMileage";


export default function RecapForm({
  code,
  token,
  template,
  coBrands = null,
  photoBuckets,
  storeIdentity = null,
  accent,
  brandName,
  eventDate,
  forceNew = false,
  shiftLabel,
  payableMiles = null,
  serverDraft = null,
  onCancel,
  onSubmitted,
  onQueued,
}: {
  code: string;
  token: string;
  template: Template | null;
  coBrands?: CoBrandOptions | null;
  photoBuckets?: PhotoBucket[];
  storeIdentity?: StoreIdentity | null;
  accent: string;
  brandName: string;
  eventDate?: string | null;
  forceNew?: boolean;
  shiftLabel?: string;
  /** When set, pre-fills the Mileage field from the itinerary (editable for detours). */
  payableMiles?: number | null;
  /** Server copy for this scope. A cleared browser restores from here. */
  serverDraft?: RecapDraft | null;
  onCancel: () => void;
  onSubmitted: () => Promise<void>;
  onQueued: () => void;
}) {
  // Prefill the brand into an "Event Name" field. Spark already knows the
  // brand, and every Total Wireless recap wants the same answer — making the
  // BA type it on a phone keyboard is pure friction, and hand-typing is how
  // you end up with "total wirless" in a client report. Still editable.
  //
  // Matched on the field NAME, so a template using different wording simply
  // doesn't prefill and the BA types it exactly as before — the same
  // name-matching approach the recap metrics use, but here a miss is
  // harmless rather than a wrong number.
  // A restored draft wins over the brand prefill: if the BA edited Event Name
  // before the tab was discarded, their wording is the answer, not ours.
  const draftScope: DraftScope = forceNew ? "additional" : "shift";
  const restored = useRef<RecapDraft | null>(
    pickRestoredDraft(readDraft(code, token, draftScope), asRecapDraft(serverDraft)),
  );

  const [values, setValues] = useState<Record<string, string | string[]>>(() => {
    const seed: Record<string, string | string[]> = {};
    if (brandName) {
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (f.name.trim().toLowerCase() === "event name" && !isPhotoType(f.type)) {
            seed[f.id] = brandName;
          }
        }
      }
    }
    // Feel Free payable miles — lock the Mileage field to the itinerary value.
    if (payableMiles != null && Number.isFinite(payableMiles)) {
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (isMileageCustomFieldName(f.name) && !isPhotoType(f.type)) {
            seed[f.id] = String(payableMiles);
          }
        }
      }
    }
    return { ...seed, ...(restored.current?.values ?? {}), ...(
      payableMiles != null && Number.isFinite(payableMiles)
        ? Object.fromEntries(
            (template?.sections ?? [])
              .flatMap((s) => s.fields)
              .filter((f) => isMileageCustomFieldName(f.name))
              .map((f) => [f.id, String(payableMiles)]),
          )
        : {}
    ) };
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;
  const [samples, setSamples] = useState<Record<string, string>>(
    () => restored.current?.samples ?? {},
  );
  const [engagements, setEngagements] = useState(
    () => restored.current?.engagements ?? "",
  );
  const [usedCorpoCard, setUsedCorpoCard] = useState<boolean | null>(
    () =>
      restored.current?.usedCorpoCard === true ||
      restored.current?.usedCorpoCard === false
        ? restored.current.usedCorpoCard
        : null,
  );
  const [store, setStore] = useState<StoreIdentityDraft>(
    () =>
      restored.current?.store ?? {
        name: storeIdentity?.name ?? "",
        number: storeIdentity?.number ?? "",
        noNumber: false,
      },
  );
  const [savedAt, setSavedAt] = useState<number | null>(
    () => restored.current?.savedAt ?? null,
  );
  const coBrand = useCoBrandRecap(coBrands, restored.current?.coBrands ?? null);
  const perBrandSections = useMemo(
    () => new Set((template?.coBrandSections ?? []).map((n) => n.trim().toLowerCase())),
    [template],
  );
  const [busy, setBusy] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<ActionPhase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const photoSeq = useRef(0);
  const photosRestored = useRef(false);
  const [photoWarnings, setPhotoWarnings] = useState<
    Record<string, PhotoQualityWarning & { name: string }>
  >({});
  const photoHashes = useRef(new Map<string, string>());
  // Deferred (post-upload) SHA-256 digests, keyed by photo id. The digest
  // used to be awaited before the PUT could start; now it lands when it
  // lands and submit merges it from this ref.
  const shaByPhotoId = useRef(new Map<string, string>());
  const shaPending = useRef(new Map<string, Promise<void>>());
  const shaOf = (p: Photo): string | undefined =>
    p.sha256 ?? shaByPhotoId.current.get(p.id);

  // Mileage step → RecapForm can race: lock miles into required field values
  // whenever the itinerary claim arrives (or updates).
  useEffect(() => {
    if (payableMiles == null || !Number.isFinite(payableMiles)) return;
    const miles = String(payableMiles);
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
          const cur = next[f.id];
          const empty =
            cur == null ||
            (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "");
          // Only fill when empty — don't clobber a detour bump the BA typed.
          if (empty) {
            next[f.id] = miles;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [payableMiles, template]);

  const uploadingCount = photos.filter((p) => p.state === "uploading").length;
  const uploadProgress = computeUploadProgress(photos);
  const failedCount = photos.filter((p) => p.state === "failed").length;
  const doneCount = photos.filter((p) => p.state === "done").length;
  const [stallTick, setStallTick] = useState(0);
  useEffect(() => {
    if (uploadingCount <= 0) return;
    const id = window.setInterval(() => setStallTick((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, [uploadingCount]);
  const stalledCount = stalledUploadingCount(
    photos.map((p) => ({
      id: p.id,
      state: p.state,
      startedAt: p.uploadStartedAt ?? null,
    })),
  );
  void stallTick;
  const stallCopy = uploadStallMessage(stalledCount, failedCount);
  // Store Wi-Fi / one bar keeps navigator.onLine true while every request
  // stalls, so all-photos-timed-out counts as offline and queues the recap.
  const allFailedOffline =
    failedCount > 0 &&
    photos.every((p) => p.state === "failed" && p.failedOffline);

  const hasPhotoField = useMemo(
    () => (template?.sections ?? []).some((s) => s.fields.some((f) => isPhotoType(f.type))),
    [template],
  );
  const templateFields = useMemo(
    () => (template?.sections ?? []).flatMap((s) => s.fields),
    [template],
  );
  const hasProductsSampledMultiselect = useMemo(
    () => templateFields.some((f) => isProductsSampledMultiselect(f)),
    [templateFields],
  );
  const hasDropOffLocations = useMemo(
    () => templateFields.some((f) => isDropOffLocationsField(f)),
    [templateFields],
  );
  // Torch (and most retail templates) already ask "total number of consumers
  // sampled". That IS Spark's engagements metric — don't make the BA type it
  // again in the native Total engagements box.
  const hideEngagementsInput = templateHasConsumersSampledField(templateFields);
  // Labelled buckets replace the single generic grid outright. They also beat
  // `hasPhotoField`: that flag HIDES the grid whenever the template carries an
  // image field, which is how adding template fields produces prompts instead
  // of buckets. Buckets are explicit brand config, so they win.
  const buckets = photoBuckets ?? [];
  // Photos with no bucket. For every brand without buckets that is all of
  // them, so the generic grid and any image-type template field behave exactly
  // as they did before buckets existed.
  const loosePhotos = photos.filter((p) => p.category === null);

  const setVal = (id: string, v: string | string[]) => setValues((p) => ({ ...p, [id]: v }));

  // Set once the recap is filed, so a late upload can't write a fresh draft
  // for a recap that's already in.
  const submittedRef = useRef(false);
  const leaveBehindArmed = useRef(false);

  const persistDraft = useCallback(
    (keepalive = false) => {
      if (submittedRef.current) return;
      const snapshot: Omit<RecapDraft, "v" | "savedAt"> = {
        values,
        samples,
        engagements,
        usedCorpoCard,
        ...(storeIdentity ? { store } : {}),
        ...(coBrands
          ? {
              coBrands: {
                enabled: coBrand.enabled,
                selected: coBrand.selected,
                values: coBrand.values,
                samples: coBrand.samples,
              },
            }
          : {}),
      };
      if (photosRestored.current) {
        snapshot.photos = photosRef.current
          .filter((p) => !p.unrecoverable)
          .map(draftPhotoOf);
      }
      const at = writeDraft(code, token, snapshot, draftScope);
      if (at) setSavedAt(at);
      const saved = readDraft(code, token, draftScope);
      if (!saved) return;
      const req = buildRecapDraftRequest({
        code,
        session: token,
        scope: draftScope,
        draft: photosRestored.current ? saved : { ...saved, photos: undefined },
      });
      if (!photosRestored.current) {
        delete (req.body.draft as { photos?: unknown }).photos;
      }
      void fetch(`${apiOrigin()}${req.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        keepalive,
      }).catch(() => {
        /* the device copy already landed */
      });
    },
    [
      code,
      token,
      draftScope,
      values,
      samples,
      engagements,
      usedCorpoCard,
      storeIdentity,
      store,
      coBrands,
      coBrand.enabled,
      coBrand.selected,
      coBrand.values,
      coBrand.samples,
      photos,
    ],
  );

  useEffect(() => {
    const t = window.setTimeout(() => persistDraft(false), 500);
    return () => window.clearTimeout(t);
  }, [persistDraft]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") persistDraft(true);
    };
    const onHide = () => persistDraft(true);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onHide);
    };
  }, [persistDraft]);
  const retryTimers = useRef(new Map<string, number>());
  const autoRetriesUsed = useRef(new Map<string, number>());
  useEffect(() => {
    const timers = retryTimers.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
    };
  }, []);
  const cancelAutoRetry = (id: string) => {
    const t = retryTimers.current.get(id);
    if (t) window.clearTimeout(t);
    retryTimers.current.delete(id);
  };

  const patchPhoto = (id: string, patch: Partial<Photo>) =>
    setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));

  const keepPhotoCheck = (id: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id && photo.check ? { ...photo, check: { ...photo.check, dismissed: true } } : photo,
      ),
    );
  };

  // Classify after the compressed copy exists. The upload is not waiting on this.
  const runPhotoCheck = (id: string, file: File) => {
    if (!token || !file.type.startsWith("image/")) return;
    const category = photosRef.current.find((photo) => photo.id === id)?.category ?? null;
    const bucketName = (photoBuckets ?? []).find((bucket) => bucket.id === category)?.name ?? null;
    void requestPhotoCheck({
      origin: apiOrigin(),
      code,
      session: token,
      file,
      contentType: file.type || "image/jpeg",
      category,
    }).then((result) => {
      if (!photosRef.current.some((photo) => photo.id === id)) return;
      const advisory = advisoryFromPhotoCheck(result, bucketName);
      patchPhoto(id, {
        check: {
          kind: advisory.kind,
          message: advisory.message,
          dismissed: false,
        },
      });
    });
  };

  // Advisory work that must never delay the PUT: SHA-256 (full-file digest),
  // the tile thumbnail, and the server photo check. All of it runs after the
  // upload has landed and patches the photo when it finishes — warnings and
  // digests merge in whenever they arrive, and nothing here can reject.
  const runDeferredPhotoChecks = (id: string, file: File) => {
    if (!file.type.startsWith("image/") || submittedRef.current) return;
    if (!photosRef.current.some((ph) => ph.id === id)) return;
    const shaTask = (async () => {
      const digest = await sha256Hex(file).catch(() => "");
      if (!digest) return;
      shaByPhotoId.current.set(id, digest);
      patchPhoto(id, { sha256: digest });
    })();
    shaPending.current.set(id, shaTask);
    void shaTask.finally(() => {
      if (shaPending.current.get(id) === shaTask) shaPending.current.delete(id);
    });
    void (async () => {
      const thumb = await makeThumbnail(file).catch(() => null);
      if (!thumb || thumb === file) return;
      if (!photosRef.current.some((ph) => ph.id === id)) return;
      setPhotos((p) =>
        p.map((ph) => {
          if (ph.id !== id) return ph;
          if (ph.previewUrl) URL.revokeObjectURL(ph.previewUrl);
          return { ...ph, previewUrl: URL.createObjectURL(thumb) };
        }),
      );
      if (!submittedRef.current) void saveDraftPhotoFile(code, token, id, thumb);
    })();
    runPhotoCheck(id, file);
  };

  // Compress once — a raw iPhone shot is 3-5MB and a BA may file dozens from a
  // parking lot on LTE. The compressed copy becomes the photo's file (retries
  // reuse it) and is what's kept on the device for a reload; the original
  // never goes to IndexedDB, it's the big write a killed tab leaves half-done.
  // Only compression stays on the critical path (the PUT needs those bytes);
  // digest / thumbnail / photo-check moved to runDeferredPhotoChecks.
  const prepareOne = (id: string, original: File) =>
    photoPrep(async () => {
      const file = await compressImage(original);
      setPhotos((p) =>
        p.map((ph) => (ph.id === id ? { ...ph, file, prepared: true } : ph)),
      );
      if (file.type.startsWith("image/") && !submittedRef.current) {
        void saveDraftPhotoFile(code, token, id, file);
      }
      return { file };
    });

  // Upload one photo, keyed by its stable id.
  const uploadOne = async (id: string, original: File, alreadyPrepared = false) => {
    try {
      if (!(await fileIsReadable(original))) {
        cancelAutoRetry(id);
        patchPhoto(id, {
          state: "failed",
          failReason: UNREADABLE_PHOTO_MESSAGE,
          failedOffline: false,
          unrecoverable: true,
          autoRetry: false,
        });
        void deleteDraftPhotoFiles(code, token, [id]);
        return;
      }
      const { file } = alreadyPrepared
        ? { file: original }
        : await prepareOne(id, original);
      const uploaded = await photoUploads(async () =>
        // Removed while it waited for a slot — don't spend the upload.
        photosRef.current.some((ph) => ph.id === id)
          ? putCheckinPhoto({ code, token, file, apiOrigin: apiOrigin() })
          : null,
      );
      if (!uploaded) return;
      autoRetriesUsed.current.delete(id);
      patchPhoto(id, {
        file,
        blobName: uploaded.blobName,
        state: "done",
        failReason: null,
        failedOffline: false,
        autoRetry: false,
      });
      // Uploaded: a reload only needs the blob name and a preview now.
      // Digest / thumbnail / advisory check run from here, off the upload
      // path — the tile is already "done" before any of them start.
      if (photosRef.current.some((ph) => ph.id === id) && !submittedRef.current) {
        if (file.type.startsWith("image/")) runDeferredPhotoChecks(id, file);
        else void deleteDraftPhotoFiles(code, token, [id]);
      }
    } catch (error) {
      const failedOffline = isOfflineClockFailure({ error });
      const failReason = failedOffline
        ? NO_SIGNAL_PHOTO_MESSAGE
        : error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Upload failed — tap Retry.";
      const autoRetry =
        retryableUploadFailure(failedOffline, failReason) && scheduleAutoRetry(id);
      patchPhoto(id, { state: "failed", failReason, failedOffline, autoRetry });
    }
  };

  const scheduleAutoRetry = (id: string): boolean => {
    if (submittedRef.current) return false;
    const used = autoRetriesUsed.current.get(id) ?? 0;
    if (used >= AUTO_RETRY_DELAYS_MS.length) return false;
    autoRetriesUsed.current.set(id, used + 1);
    cancelAutoRetry(id);
    const timer = window.setTimeout(() => {
      retryTimers.current.delete(id);
      const ph = photosRef.current.find((p) => p.id === id);
      if (!ph || ph.state !== "failed" || ph.unrecoverable || submittedRef.current) return;
      patchPhoto(id, { state: "uploading", autoRetry: false });
      void uploadOne(id, ph.file, Boolean(ph.prepared));
    }, AUTO_RETRY_DELAYS_MS[used]);
    retryTimers.current.set(id, timer);
    return true;
  };

  // Advisory only: warn while the BA is still on site, never block the upload.
  // Runs concurrently per photo (it used to walk the batch one photo at a
  // time) and is launched after the uploads, so its CPU never delays a PUT.
  // Duplicate resolution stays deterministic: hashes may land in any order,
  // but the earliest photo in pick order keeps the hash and later copies warn.
  const assessPhotos = async (batch: Photo[]) => {
    const targets = batch.filter(
      (ph) => !ph.file.type.startsWith("video/") && ph.file.size > 0,
    );
    const hashed = await Promise.all(
      targets.map(async (ph) => {
        try {
          return { ph, hash: await quickPhotoHash(ph.file) };
        } catch {
          return { ph, hash: null as string | null };
        }
      }),
    );
    const duplicates = new Set<string>();
    for (const { ph, hash } of hashed) {
      if (!hash) continue;
      const prior = photoHashes.current.get(hash);
      if (prior && prior !== ph.id) {
        duplicates.add(ph.id);
        if (photosRef.current.some((p) => p.id === ph.id)) {
          setPhotoWarnings((prev) => ({
            ...prev,
            [ph.id]: {
              photoId: ph.id,
              kind: "duplicate" as const,
              message: qualityMessage("duplicate"),
              name: ph.file.name,
            },
          }));
        }
      } else {
        photoHashes.current.set(hash, ph.id);
      }
    }
    await Promise.all(
      targets
        .filter((ph) => !duplicates.has(ph.id))
        .map(async (ph) => {
          try {
            const stats = await analyzePhotoFile(ph.file);
            const kind = stats ? classifyPhotoQuality(stats) : null;
            if (kind && photosRef.current.some((p) => p.id === ph.id)) {
              setPhotoWarnings((prev) => ({
                ...prev,
                [ph.id]: {
                  photoId: ph.id,
                  kind,
                  message: qualityMessage(kind),
                  name: ph.file.name,
                },
              }));
            }
          } catch {
            /* advisory only — a failed check is no warning, never an error */
          }
        }),
    );
  };

  const uploadFiles = async (files: FileList | null, category: string | null = null) => {
    if (!files || !files.length) return;
    const room = Math.max(0, PHOTO_CAP - photosRef.current.length);
    if (room === 0) {
      setErr(`Photo limit reached (${PHOTO_CAP}). Remove some to add more.`);
      return;
    }
    const picked = Array.from(files);
    const accepted = picked.slice(0, room);
    if (picked.length > accepted.length) {
      setErr(
        `Only ${room} more photo${room === 1 ? "" : "s"} fit (max ${PHOTO_CAP}). Added the first ${accepted.length}.`,
      );
    } else {
      setErr(null);
    }
    const batch: Photo[] = accepted.map((file) => ({
      id: `${Date.now()}-${photoSeq.current++}`,
      file,
      blobName: null,
      previewUrl: URL.createObjectURL(file),
      state: "uploading" as const,
      uploadStartedAt: Date.now(),
      category,
    }));
    // Keep the ref ahead of re-render so a second library pick mid-upload
    // still sees the true remaining room.
    photosRef.current = [...photosRef.current, ...batch];
    setPhotos(photosRef.current);
    // Uploads start first; quality/duplicate assessment runs alongside and
    // merges its warnings in as they land.
    const uploads = batch.map((ph) => uploadOne(ph.id, ph.file));
    void assessPhotos(batch);
    await Promise.all(uploads);
  };

  // Put back what the last page life had — "Take photo" often costs the page
  // (see photoDraft.ts). Unfinished uploads resume from the saved bytes.
  // Blob names already on the server draft come back too, without replacing
  // the on-device bytes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadDraftPhotos(code, token);
      if (cancelled) return;
      photosRestored.current = true;
      const have = new Set(photosRef.current.map((p) => p.id));
      const fromDevice: Photo[] = saved
        .filter(({ photo }) => !have.has(photo.id))
        .map(({ photo, file }): Photo => ({
          id: photo.id,
          file: file ?? new File([], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" }),
          blobName: photo.blobName,
          previewUrl: file ? URL.createObjectURL(file) : "",
          state: photo.blobName ? "done" : "uploading",
          category: photo.category,
          ...(photo.sha256 ? { sha256: photo.sha256 } : {}),
        }));
      const seen = new Set([...have, ...fromDevice.map((p) => p.id)]);
      const fromServer: Photo[] = (restored.current?.photos ?? [])
        .filter((photo) => photo.blobName && !seen.has(photo.id))
        .map((photo): Photo => ({
          id: photo.id,
          file: new File([], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" }),
          blobName: photo.blobName,
          previewUrl: "",
          state: "done",
          category: photo.category,
          ...(photo.sha256 ? { sha256: photo.sha256 } : {}),
        }));
      const back = [...fromDevice, ...fromServer];
      photosRef.current = [...back, ...photosRef.current];
      setPhotos(photosRef.current);
      writeDraftPhotos(code, token, photosRef.current.filter((p) => !p.unrecoverable).map(draftPhotoOf));
      await Promise.all(
        back.filter((p) => p.state === "uploading").map((ph) => uploadOne(ph.id, ph.file)),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token]);

  useEffect(() => {
    if (!photosRestored.current || submittedRef.current) return;
    writeDraftPhotos(code, token, photos.filter((p) => !p.unrecoverable).map(draftPhotoOf));
  }, [code, token, photos]);

  const retryFailed = async () => {
    const stuck = photosRef.current.filter((p) => p.state === "failed" && !p.unrecoverable);
    if (!stuck.length) return;
    setErr(null);
    const ids = new Set(stuck.map((p) => p.id));
    for (const id of ids) {
      cancelAutoRetry(id);
      autoRetriesUsed.current.delete(id);
    }
    setPhotos((p) =>
      p.map((ph) => (ids.has(ph.id) ? { ...ph, state: "uploading", autoRetry: false } : ph)),
    );
    await Promise.all(stuck.map((ph) => uploadOne(ph.id, ph.file, Boolean(ph.prepared))));
  };

  const removeFailed = () => {
    const failed = photosRef.current.filter((p) => p.state === "failed");
    if (!failed.length) return;
    for (const ph of failed) cancelAutoRetry(ph.id);
    const next = photosRef.current.filter((p) => p.state !== "failed");
    photosRef.current = next;
    setPhotos(next);
    void deleteDraftPhotoFiles(code, token, failed.map((p) => p.id));
  };

  // Keyed by id, never by index. Each bucket renders its OWN filtered slice, so
  // position 0 of a bucket is some arbitrary position in `photos` — the same
  // index-vs-id confusion that once wrote every upload result into one slot.
  const removePhoto = (id: string) => {
    const next = photosRef.current.filter((ph) => ph.id !== id);
    photosRef.current = next;
    setPhotos(next);
    cancelAutoRetry(id);
    setPhotoWarnings((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    for (const [hash, owner] of photoHashes.current) {
      if (owner === id) photoHashes.current.delete(hash);
    }
    shaByPhotoId.current.delete(id);
    shaPending.current.delete(id);
    void deleteDraftPhotoFiles(code, token, [id]);
  };

  const submit = async () => {
    setErr(null);
    const storeName = store.name.trim();
    const storeNumber = store.noNumber ? "" : store.number.trim().replace(/^#\s*/, "");
    if (storeIdentity) {
      if (!storeName) return setErr("Enter the store name.");
      if (!storeNumber && !store.noNumber) {
        return setErr("Enter the store number, or tick \"No store number\".");
      }
    }
    const storeFields = storeIdentity ? { storeName, storeNumber } : {};
    // Ensure itinerary miles are in values before required-field checks
    // (covers any race where the mileage step → recap handoff lagged).
    const valuesForSubmit = { ...values };
    if (payableMiles != null && Number.isFinite(payableMiles)) {
      for (const f of templateFields) {
        if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
        const cur = valuesForSubmit[f.id];
        const empty =
          cur == null ||
          (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "");
        if (empty) valuesForSubmit[f.id] = String(payableMiles);
      }
    }
    // Required non-photo fields must be answered.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (!f.required || isPhotoType(f.type) || !isFieldShown(f, valuesForSubmit)) continue;
        const v = valuesForSubmit[f.id];
        if (isDropOffLocationsField(f)) {
          const dropErr = validateDropOffLocationsValue(
            Array.isArray(v) ? JSON.stringify(v) : String(v ?? ""),
          );
          if (dropErr) return setErr(dropErr);
          continue;
        }
        const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
        if (empty) return setErr(`Please fill in "${f.name}".`);
      }
    }
    // Dollar spend fields: 2489 (no period) is rejected, not treated as
    // two thousand. 24.89 / 24.8 / 2489.00 store as a numeric dollar string.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (isPhotoType(f.type) || !isSpendAmountField(f)) continue;
        const v = valuesForSubmit[f.id];
        const raw = Array.isArray(v) ? "" : String(v ?? "");
        const spendErr = spendAmountError(raw);
        if (spendErr) return setErr(`${f.name}: ${spendErr}`);
        const stored = spendAmountStored(raw);
        if (stored != null) valuesForSubmit[f.id] = stored;
      }
    }
    const coBrandErr = coBrand.validate();
    if (coBrandErr) return setErr(coBrandErr);
    if (usedCorpoCard == null) {
      return setErr("Please say whether a corporate card was used.");
    }
    // Digests are computed after upload now; give any still-running one a
    // moment so the recap carries it, but never let one block filing.
    if (shaPending.current.size > 0) {
      await Promise.allSettled([...shaPending.current.values()]);
    }
    const donePhotos = photos.filter((p) => p.state === "done" && p.blobName);
    // Photos that FAILED must never block: a BA standing in a parking lot on
    // one bar has to be able to finish and clock out. The button label tells
    // them exactly how many they're leaving behind, and Retry is right there.
    // Uploads still in flight get one warning; a second tap sends what landed.
    if (uploadingCount > 0) {
      const many = `${uploadingCount} photo${uploadingCount === 1 ? "" : "s"}`;
      const progress = ` (${uploadProgress.percent}% done)`;
      if (donePhotos.length === 0)
        return setErr(`Still uploading ${many}${progress} — one moment.`);
      if (!leaveBehindArmed.current) {
        leaveBehindArmed.current = true;
        return setErr(
          `Still uploading ${many}${progress}. Wait for ${uploadingCount === 1 ? "it" : "them"}, or tap Submit again to send the ${donePhotos.length} that finished.`,
        );
      }
    }
    leaveBehindArmed.current = false;
    const offlineNow =
      (typeof navigator !== "undefined" && navigator.onLine === false) || allFailedOffline;
    if (donePhotos.length === 0) {
      if (!(failedCount > 0 && offlineNow)) {
        return setErr(
          failedCount > 0
            ? "No photos uploaded yet. Tap Retry, or check your signal."
            : "Add at least one photo of your event.",
        );
      }
    }

    const fieldValues = Object.entries(withoutHiddenValues(templateFields, valuesForSubmit))
      .map(([id, v]) => ({ customFieldId: id, value: Array.isArray(v) ? JSON.stringify(v) : String(v) }))
      .filter((fv) => fv.value !== "" && fv.value !== "[]");
    // Prefer Drop-off Locations JSON (Product Seeding), then Products Sampled
    // pills, then the plain per-SKU qty grid.
    const fromDropOffs = (() => {
      const out: { productId: string; quantity: number }[] = [];
      for (const f of templateFields) {
        if (!isDropOffLocationsField(f)) continue;
        const raw = valuesForSubmit[f.id];
        const locs = parseDropOffLocations(
          Array.isArray(raw) ? JSON.stringify(raw) : String(raw ?? ""),
        );
        out.push(...productSamplesFromDropOffs(locs));
      }
      // Merge duplicate productIds if multiple drop-off fields ever exist.
      const totals = new Map<string, number>();
      for (const row of out) {
        totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity);
      }
      return [...totals.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    })();
    const fromPills = (() => {
      if (!hasProductsSampledMultiselect) return [] as { productId: string; quantity: number }[];
      const selected: string[] = [];
      for (const f of templateFields) {
        if (!isProductsSampledMultiselect(f)) continue;
        const raw = values[f.id];
        if (Array.isArray(raw)) selected.push(...raw.map(String));
      }
      return productSamplesFromSelections(
        selected,
        samples,
        template?.products ?? [],
        (raw) => {
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        },
      );
    })();
    const fromGrid = Object.entries(samples)
      .map(([productId, q]) => ({ productId, quantity: Number(q) }))
      .filter((s) => Number.isFinite(s.quantity) && s.quantity > 0);
    const productSamples =
      fromDropOffs.length > 0
        ? fromDropOffs
        : fromPills.length > 0
          ? fromPills
          : hasProductsSampledMultiselect
            ? []
            : fromGrid;
    const fromSamples = engagementsFromSamplesGiven(templateFields, values);
    const typed = engagements.trim() === "" ? null : Number(engagements);
    const totalEngagements = fromSamples ?? (Number.isFinite(typed) ? typed : null);
    const submittedAt = new Date().toISOString();
    const coBrandsBody = coBrand.payload();

    const queueThisSubmit = async () => {
      const photoFiles: Record<string, File> = {};
      const files = photos
        .filter((p) => p.state !== "uploading" && !p.unrecoverable)
        .map((p) => {
          if (!p.blobName) photoFiles[p.id] = p.file;
          return {
            id: p.id,
            blobName: p.blobName,
            category: p.category,
            ...(shaOf(p) ? { sha256: shaOf(p) } : {}),
            filename: p.file.name || "photo.jpg",
            contentType: browserPlayableContentType({
              type: p.file.type,
              name: p.file.name,
            }),
          };
        });
      await enqueueRecap({
        code,
        token,
        fieldValues,
        files,
        productSamples,
        totalEngagements,
        usedCorpoCard,
        ...storeFields,
        coBrands: coBrandsBody,
        forceNew,
        shiftLabel: forceNew ? shiftLabel : undefined,
        secondShift: Boolean(forceNew && shiftLabel),
        submittedAt,
        photoFiles,
      });
      // Draft stays until the server ACKs — flushQueuedRecap clears it.
      onQueued();
    };

    setBusy(true);
    setSubmitPhase("pending");
    try {
      // Recap can be drafted offline. If a clock-in is still queued, attach
      // it first so the API sees the shift that started at tap time.
      await flushPendingClock({
        code,
        postClock: (body) => postCheckinClock(code, { session: token, ...body }),
      });
      await flushPendingMileage({
        code,
        postMileage: (body) =>
          postCheckinPayableMileage(code, { session: token, ...body }),
      });
      if (offlineNow) {
        await queueThisSubmit();
        setSubmitPhase("success");
        await holdActionSuccess();
        return;
      }
      const existing = readPendingRecap(code);
      const recapBody = {
        session: token,
        idempotencyKey: existing && existing.token === token ? existing.id : undefined,
        fieldValues,
        files: donePhotos.map((p) => ({
          blobName: p.blobName,
          category: p.category,
          ...(shaOf(p) ? { sha256: shaOf(p) } : {}),
        })),
        productSamples,
        totalEngagements,
        usedCorpoCard,
        ...storeFields,
        ...(coBrandsBody ? { coBrands: coBrandsBody } : {}),
        forceNew,
        ...(forceNew && shiftLabel
          ? { shiftLabel, secondShift: true }
          : {}),
      };
      const posted = await postCheckinRecap(code, recapBody);
      if (!posted.ok && !posted.already) {
        if (isOfflineClockFailure({ status: posted.status })) {
          await queueThisSubmit();
          return;
        }
        setErr(posted.message || "Couldn't submit your recap.");
        setBusy(false);
        setSubmitPhase("idle");
        return;
      }
      // Filed — the draft has served its purpose. Cleared before the parent
      // unmounts this form so a later shift can't resurrect these answers.
      submittedRef.current = true;
      for (const id of [...retryTimers.current.keys()]) cancelAutoRetry(id);
      clearDraft(code, token);
      setSubmitPhase("success");
      await holdActionSuccess();
      await onSubmitted();
    } catch (error) {
      if (isOfflineClockFailure({ error })) {
        await queueThisSubmit();
        setSubmitPhase("success");
        await holdActionSuccess();
        return;
      }
      setErr("Network error. Try again.");
      setBusy(false);
      setSubmitPhase("idle");
    }
  };

  if (!template) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <p style={{ opacity: 0.7 }}>This event has no recap form set up. Ask your lead.</p>
        <button style={{ ...secondaryBtn, marginTop: 12 }} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  const pendingClock = readPendingClock(code);
  const pendingRecap = readPendingRecap(code);
  const pendingMileage = readPendingMileage(code);
  const completenessValues = { ...values };
  if (payableMiles != null && Number.isFinite(payableMiles)) {
    for (const f of templateFields) {
      if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
      const cur = completenessValues[f.id];
      if (cur == null || (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "")) {
        completenessValues[f.id] = String(payableMiles);
      }
    }
  }
  const completenessItems = buildCompletenessItems({
    fields: templateFields,
    values: completenessValues,
    buckets,
    photos: photos.map((p) => ({ category: p.category, state: p.state })),
    hasPhotoField,
    usedCorpoCard,
    storeIdentity: Boolean(storeIdentity),
    store,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {eventDate ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: 0 }}>
          Recap for {fmtDay(eventDate)}
          {forceNew && shiftLabel
            ? ` · ${shiftLabel}`
            : forceNew
              ? " · additional filing"
              : ""}
        </p>
      ) : null}
      {pendingClock ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineClockBanner(pendingClock.clockedInAt)} You can still fill this
          recap — it stays on this device until it sends.
        </p>
      ) : null}
      {pendingMileage ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineMileageBanner()}
        </p>
      ) : null}
      {pendingRecap ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineRecapBanner(pendingRecap.submittedAt)}
        </p>
      ) : null}
      {payableMiles != null && Number.isFinite(payableMiles) ? (
        <div
          style={{
            ...card,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
          }}
        >
          <strong>Route miles: {formatPayableMiles(payableMiles)}</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.9 }}>
            {Number(payableMiles) === 0
              ? "No reimbursable mileage for this shift. You can still bump the Mileage field below if needed."
              : "Pre-filled from Google Maps driving directions through your stops (when available). If construction or detours added distance, bump the Mileage field below before you submit."}
          </p>
        </div>
      ) : null}
      {storeIdentity ? (
        <div style={card} data-completeness-target="store">
          <h2 style={h2}>Store</h2>
          <label style={label}>
            Store name <span style={{ color: "#EF5A2A" }}>*</span>
          </label>
          <input
            style={input}
            placeholder="e.g. Total Wine & More"
            autoComplete="off"
            value={store.name}
            onChange={(e) => setStore((s) => ({ ...s, name: e.target.value }))}
          />
          <label style={{ ...label, marginTop: 10 }}>
            Store # <span style={{ color: "#EF5A2A" }}>*</span>
          </label>
          <input
            style={{ ...input, opacity: store.noNumber ? 0.45 : 1 }}
            placeholder="e.g. 1234"
            autoComplete="off"
            disabled={store.noNumber}
            value={store.noNumber ? "" : store.number}
            onChange={(e) => setStore((s) => ({ ...s, number: e.target.value }))}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={store.noNumber}
              onChange={(e) => setStore((s) => ({ ...s, noNumber: e.target.checked }))}
            />
            No store number (independent store)
          </label>
        </div>
      ) : null}
      <CoBrandToggleCard
        state={coBrand}
        hostName={brandName}
        accent={accent}
        cardStyle={card}
        headingStyle={h2}
      />
      {token ? (
        <div style={card}>
          <VoiceRecapCard
            origin={apiOrigin()}
            code={code}
            session={token}
            fields={templateFields}
            accent={accent}
            onApply={(fills: VoiceFill[]) =>
              setValues((current) => applyVoiceFills(current, fills, templateFields))
            }
          />
        </div>
      ) : null}
      {template.sections.map((section) => {
        // Mileage moves to the end of the recap (after photos). Skip empty
        // sections that only held mileage fields.
        const fields = section.fields.filter(
          (f) => !isMileageCustomFieldName(f.name) && isFieldShown(f, values),
        );
        if (fields.length === 0) return null;
        const labelBrand =
          coBrand.active.length > 0 &&
          perBrandSections.has(section.name.trim().toLowerCase());
        return (
        <div key={section.id} style={card}>
          <h2 style={h2}>{labelBrand ? `${brandName} · ${section.name}` : section.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {fields.map((f) => (
              <div key={f.id} data-completeness-target={f.id}>
              <FieldInput
                field={f}
                value={values[f.id]}
                accent={accent}
                onChange={(v) => setVal(f.id, v)}
                onAddPhotos={uploadFiles}
                photos={loosePhotos}
                onRemovePhoto={removePhoto}
                onKeepPhoto={keepPhotoCheck}
                products={template.products}
                sampleQtys={samples}
                onSampleQtyChange={(productId, qty) =>
                  setSamples((s) => ({ ...s, [productId]: qty }))
                }
                qtyContextName={template.name}
                qtyLabel={template.sampleQtyLabel}
                qtyTotalLabel={template.sampleQtyTotalLabel}
              />
              </div>
            ))}
          </div>
        </div>
        );
      })}

      <CoBrandSections
        state={coBrand}
        cardStyle={card}
        headingStyle={h2}
        renderField={({ brand, field, value, onChange, sampleQtys, onSampleQtyChange }) => (
          <FieldInput
            field={field}
            value={value}
            accent={brand.primaryColor || accent}
            onChange={onChange}
            onAddPhotos={uploadFiles}
            photos={[]}
            onRemovePhoto={removePhoto}
            products={brand.products}
            sampleQtys={sampleQtys}
            onSampleQtyChange={onSampleQtyChange}
            qtyContextName={brand.name}
            qtyLabel={template.sampleQtyLabel}
            qtyTotalLabel={template.sampleQtyTotalLabel}
          />
        )}
      />

      {/* Full per-SKU qty grid only when there is no Products Sampled
          multiselect and no Drop-off Locations repeater — LD seeding
          captures cases per stop on that field instead. */}
      {template.productSamples &&
      template.products.length > 0 &&
      !hasProductsSampledMultiselect &&
      !hasDropOffLocations ? (
        <div style={card}>
          <h2 style={h2}>Products sampled</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {template.products.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} />
                ) : null}
                <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                <input
                  style={{ ...input, width: 88, margin: 0 }}
                  inputMode="numeric"
                  placeholder="0"
                  value={samples[p.id] ?? ""}
                  onChange={(e) => setSamples((s) => ({ ...s, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hideEngagementsInput || (buckets.length === 0 && !hasPhotoField) ? (
      <div style={card}>
        {!hideEngagementsInput ? (
          <>
            <label style={label}>Total engagements</label>
            <input style={input} inputMode="numeric" placeholder="e.g. 120" value={engagements} onChange={(e) => setEngagements(e.target.value)} />
          </>
        ) : null}
        {buckets.length === 0 && !hasPhotoField ? (
          <>
            <label style={{ ...label, marginTop: hideEngagementsInput ? 0 : 10 }}>
              Photos <span style={{ color: "#EF5A2A" }}>*</span>
            </label>
            <div data-completeness-target="photos">
              <PhotoGrid
                photos={loosePhotos}
                onAdd={() => libraryRef.current?.click()}
                onTake={() => cameraRef.current?.click()}
                onRemove={removePhoto}
                onKeep={keepPhotoCheck}
                onRetake={(id) => {
                  removePhoto(id);
                  cameraRef.current?.click();
                }}
                accent={accent}
              />
            </div>
            <PhotoFileInputs
              libraryRef={libraryRef}
              cameraRef={cameraRef}
              onFiles={(files) => void uploadFiles(files)}
            />
          </>
        ) : null}
      </div>
      ) : null}

      {buckets.length === 0 ? (
        <div style={card}>
          <CorpoCardYesNo
            value={usedCorpoCard}
            accent={accent}
            onChange={setUsedCorpoCard}
          />
        </div>
      ) : null}

      {buckets.length > 0 ? (
        <div style={card}>
          <h2 style={h2}>Photos</h2>
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "6px 0 0" }}>
            Put each shot in its own group so they land in the right place on
            the client report.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
            {buckets.length > 0 &&
            !buckets.some((b) => isExpenseReceiptBucket(b.name)) ? (
              <CorpoCardYesNo
                value={usedCorpoCard}
                accent={accent}
                onChange={setUsedCorpoCard}
              />
            ) : null}
            {buckets.map((b) => (
              <Fragment key={b.id}>
                {isExpenseReceiptBucket(b.name) &&
                buckets.find((row) => isExpenseReceiptBucket(row.name))?.id ===
                  b.id ? (
                  <CorpoCardYesNo
                    value={usedCorpoCard}
                    accent={accent}
                    onChange={setUsedCorpoCard}
                  />
                ) : null}
                <PhotoBucketZone
                  bucket={b}
                  photos={photos.filter((p) => p.category === b.id)}
                  onAdd={uploadFiles}
                  onRemove={removePhoto}
                  onKeep={keepPhotoCheck}
                  accent={accent}
                />
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}

      {/* Total mileage — end of the recap (after photos), still required. */}
      {(() => {
        const mileageFields = template.sections.flatMap((s) =>
          s.fields.filter((f) => isMileageCustomFieldName(f.name)),
        );
        if (mileageFields.length === 0) return null;
        return (
          <div style={card}>
            <h2 style={h2}>Mileage</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {mileageFields.map((f) =>
                payableMiles != null && Number.isFinite(payableMiles) ? (
                  <div key={f.id}>
                    <label style={label}>
                      {f.name}
                      {f.required ? (
                        <span style={{ color: "#EF5A2A" }}> *</span>
                      ) : null}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      style={{
                        ...input,
                        background: "#fff",
                        color: "#065f46",
                        fontWeight: 600,
                      }}
                      value={
                        values[f.id] != null && !Array.isArray(values[f.id])
                          ? String(values[f.id])
                          : String(payableMiles)
                      }
                      onChange={(e) => setVal(f.id, e.target.value)}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
                      Suggested {formatPayableMiles(payableMiles)}. Increase if
                      detours / construction added miles.
                    </p>
                  </div>
                ) : (
                  <FieldInput
                    key={f.id}
                    field={f}
                    value={values[f.id]}
                    accent={accent}
                    onChange={(v) => setVal(f.id, v)}
                    onAddPhotos={uploadFiles}
                    photos={loosePhotos}
                    onRemovePhoto={removePhoto}
                    products={template.products}
                    sampleQtys={samples}
                    onSampleQtyChange={(productId, qty) =>
                      setSamples((s) => ({ ...s, [productId]: qty }))
                    }
                    qtyContextName={template.name}
                    qtyLabel={template.sampleQtyLabel}
                    qtyTotalLabel={template.sampleQtyTotalLabel}
                  />
                ),
              )}
            </div>
          </div>
        );
      })()}

      {uploadingCount > 0 ? (
        <p style={{ color: "#44403c", textAlign: "center", fontSize: 13, opacity: 1 }} aria-live="polite">
          {formatUploadProgress(uploadProgress)}
        </p>
      ) : null}

      {stallCopy && stalledCount > 0 ? (
        <div style={{ ...card, borderColor: "#EF5A2A" }} aria-live="polite">
          <p style={{ fontSize: 13, margin: 0 }}>{stallCopy}</p>
        </div>
      ) : null}

      {failedCount > 0 ? (
        <div style={{ ...card, borderColor: "#EF5A2A", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              {failedCount} photo{failedCount === 1 ? "" : "s"} didn't upload.
              {(() => {
                const reasons = [
                  ...new Set(
                    photos
                      .filter((p) => p.state === "failed" && p.failReason)
                      .map((p) => p.failReason as string),
                  ),
                ];
                if (reasons.length === 1) return ` ${reasons[0]}`;
                if (reasons.includes(UNREADABLE_PHOTO_MESSAGE)) {
                  return " Some didn't stay saved on your phone — tap Remove failed, then take or pick those again.";
                }
                if (reasons.some((r) => /too many|wait a minute/i.test(r))) {
                  return " Too many uploads at once — wait a minute, then tap Retry.";
                }
                return " Tap Retry — or re-pick from your library (JPEG works best if HEIC keeps failing).";
              })()}
              {photos.some((p) => p.state === "failed" && p.autoRetry)
                ? " Retrying automatically…"
                : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {photos.some((p) => p.state === "failed" && !p.unrecoverable) ? (
              <button style={{ ...secondaryBtn, flex: 1, padding: "8px 14px", margin: 0 }} onClick={retryFailed}>
                Retry
              </button>
            ) : null}
            <button style={{ ...secondaryBtn, flex: 1, padding: "8px 14px", margin: 0 }} onClick={removeFailed}>
              Remove failed
            </button>
          </div>
        </div>
      ) : null}

      <PhotoQualityWarnings
        warnings={Object.values(photoWarnings)}
        onKeep={(photoId) =>
          setPhotoWarnings((prev) => {
            const copy = { ...prev };
            delete copy[photoId];
            return copy;
          })
        }
        onRetake={removePhoto}
      />

      <RecapCompletenessChecklist items={completenessItems} />

      {err ? <p style={{ ...errText, textAlign: "center" }}>{err}</p> : null}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4,
          paddingTop: 10,
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          background: "#faf7f1",
          borderTop: "1px solid rgba(28, 25, 23, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 18 }}>
          {savedAt ? (
            <p
              aria-live="polite"
              style={{
                color: "#44403c",
                fontSize: 12,
                opacity: 1,
                textAlign: "center",
                margin: 0,
              }}
            >
              {draftSavedLabel(savedAt)}
            </p>
          ) : (
            <span style={{ color: "#78716c", fontSize: 12 }}>
              Photos: library or camera · multiple OK
            </span>
          )}
          <button
            type="button"
            onClick={() => persistDraft(false)}
            disabled={busy}
            style={{
              border: "none",
              background: "transparent",
              color: "#1c1917",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              padding: "4px 2px",
            }}
          >
            Save
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={onCancel} disabled={busy}>
            Back
          </button>
          <ActionMorphButton
            style={primaryBtn(accent)}
            onClick={submit}
            disabled={busy || (uploadingCount > 0 && doneCount === 0)}
            phase={submitPhase}
            pendingLabel="Submitting…"
            successLabel="Submitted"
          >
            {allFailedOffline
              ? "Save & send when back online"
              : failedCount + uploadingCount > 0 && doneCount > 0
                ? `Submit without ${failedCount + uploadingCount} photo${failedCount + uploadingCount === 1 ? "" : "s"}`
                : "Submit recap"}
          </ActionMorphButton>
        </div>
      </div>
    </div>
  );
}

// ── Multiselect (Products Sampled gets search when the SKU list is long) ──
function MultiselectFieldInput({
  field,
  value,
  accent: _accent,
  onChange,
  products,
  sampleQtys,
  onSampleQtyChange,
  req,
  labelStyle,
  qtyContextName,
  qtyLabel,
  qtyTotalLabel,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string[]) => void;
  products: TemplateProduct[];
  sampleQtys: Record<string, string>;
  onSampleQtyChange?: (productId: string, qty: string) => void;
  req: ReactNode;
  labelStyle: CSSProperties;
  qtyContextName?: string | null;
  qtyLabel?: string | null;
  qtyTotalLabel?: string | null;
}) {
  const [skuFilter, setSkuFilter] = useState("");
  const arr = Array.isArray(value) ? value : [];
  const qtyMode =
    isProductsSampledMultiselect(field) &&
    Boolean(onSampleQtyChange) &&
    products.length > 0;
  const qtyUnit = productSampleQtyUnit(qtyContextName ?? field.name, qtyLabel);
  const searchable = field.options.length > 24;
  const visibleOptions = useMemo(() => {
    const q = skuFilter.trim().toLowerCase();
    if (!q) return field.options;
    return field.options.filter((o) => o.toLowerCase().includes(q));
  }, [field.options, skuFilter]);

  const toggle = (o: string) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next);
    if (!qtyMode || !onSampleQtyChange) return;
    const product = matchProductForSampleOption(o, products);
    if (!product) return;
    if (next.includes(o)) {
      if (sampleQtys[product.id] == null) onSampleQtyChange(product.id, "");
    } else {
      onSampleQtyChange(product.id, "");
    }
  };
  const selectedWithProduct = qtyMode
    ? arr
        .map((o) => {
          const product = matchProductForSampleOption(o, products);
          return product ? { option: o, product } : null;
        })
        .filter((row): row is { option: string; product: TemplateProduct } =>
          Boolean(row),
        )
    : [];
  const qtyTotal = selectedWithProduct.reduce((sum, { product }) => {
    const n = parseInt(sampleQtys[product.id] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);

  return (
    <div>
      <label style={labelStyle}>
        {field.name}
        {req}
      </label>
      {qtyMode ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "4px 0 0" }}>
          {productSampleQtyHelper(qtyContextName ?? field.name, qtyLabel)}
          {searchable ? ` Search filters the list (${arr.length} selected).` : null}
        </p>
      ) : null}
      {searchable ? (
        <input
          style={{ ...input, marginTop: 8 }}
          type="search"
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          placeholder="Search SKUs or brand line…"
          enterKeyHint="search"
          autoComplete="off"
        />
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {visibleOptions.map((o) => {
          const on = arr.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={`recap-option-chip${on ? " is-selected" : ""}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {searchable && visibleOptions.length === 0 ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, marginTop: 8 }}>
          No SKUs match “{skuFilter.trim()}”.
        </p>
      ) : null}
      {selectedWithProduct.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {qtyLabel ? (
            <div
              style={{
                color: "#44403c",
                display: "flex",
                justifyContent: "flex-end",
                fontSize: 12,
                fontWeight: 600,
                opacity: 1,
              }}
            >
              <span style={{ width: 88, textAlign: "center" }}>{qtyLabel}</span>
            </div>
          ) : null}
          {selectedWithProduct.map(({ option, product }) => (
            <div
              key={product.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <span style={{ flex: 1, fontSize: 14, minWidth: 0 }} title={option}>
                {product.name}
              </span>
              <input
                style={{ ...input, width: 88, margin: 0 }}
                inputMode="numeric"
                placeholder={qtyUnit}
                aria-label={`${qtyLabel || (qtyUnit === "cases" ? "Cases" : "Cans")} — ${product.name}`}
                value={sampleQtys[product.id] ?? ""}
                onChange={(e) => onSampleQtyChange?.(product.id, e.target.value)}
              />
            </div>
          ))}
          {qtyTotalLabel ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(0,0,0,0.1)",
                paddingTop: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span>{qtyTotalLabel}</span>
              <span style={{ width: 88, textAlign: "center" }}>
                {qtyTotal.toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── One template field ───────────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  accent,
  onChange,
  onAddPhotos,
  photos,
  onRemovePhoto,
  onKeepPhoto,
  products = [],
  sampleQtys = {},
  onSampleQtyChange,
  qtyContextName,
  qtyLabel,
  qtyTotalLabel,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string | string[]) => void;
  onAddPhotos: (files: FileList | null) => void;
  photos: Photo[];
  onRemovePhoto: (id: string) => void;
  onKeepPhoto?: (id: string) => void;
  products?: TemplateProduct[];
  sampleQtys?: Record<string, string>;
  onSampleQtyChange?: (productId: string, qty: string) => void;
  qtyContextName?: string | null;
  qtyLabel?: string | null;
  qtyTotalLabel?: string | null;
}) {
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const req = field.required ? <span style={{ color: "#EF5A2A" }}> *</span> : null;

  if (isDropOffLocationsField(field)) {
    return (
      <DropOffLocationsField
        label={field.name}
        value={typeof value === "string" ? value : Array.isArray(value) ? JSON.stringify(value) : ""}
        onChange={(v) => onChange(v)}
        products={products}
        required={field.required}
        theme="checkin"
        accent={accent}
      />
    );
  }

  if (isPhotoType(field.type)) {
    return (
      <div data-completeness-target={field.id}>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <PhotoGrid
          photos={photos}
          onAdd={() => libraryRef.current?.click()}
          onTake={() => cameraRef.current?.click()}
          onRemove={onRemovePhoto}
          onKeep={onKeepPhoto}
          onRetake={(id) => {
            onRemovePhoto(id);
            cameraRef.current?.click();
          }}
          accent={accent}
        />
        <PhotoFileInputs
          libraryRef={libraryRef}
          cameraRef={cameraRef}
          onFiles={onAddPhotos}
        />
      </div>
    );
  }

  const kind = choiceKind(field.type);
  if (kind === "select") {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <select style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "multiselect") {
    return (
      <MultiselectFieldInput
        field={field}
        value={value}
        accent={accent}
        onChange={onChange}
        products={products}
        sampleQtys={sampleQtys}
        onSampleQtyChange={onSampleQtyChange}
        req={req}
        labelStyle={label}
        qtyContextName={qtyContextName}
        qtyLabel={qtyLabel}
        qtyTotalLabel={qtyTotalLabel}
      />
    );
  }

  const isLong = field.type.includes("long") || field.type.includes("area") || field.type.includes("paragraph");
  const isNumber = field.type.includes("number") || field.type.includes("int") || field.type.includes("decimal");
  const example = (field.placeholder || "").trim();
  if (!isLong && isSpendAmountField(field)) {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <SpendAmountInput
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          inputStyle={input}
          ariaLabel={field.name}
        />
      </div>
    );
  }
  return (
    <div>
      <label style={label}>
        {field.name}
        {req}
      </label>
      {isLong ? (
        <textarea
          style={{ ...input, minHeight: example ? 120 : 84, resize: "vertical" }}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example || undefined}
        />
      ) : (
        <input
          style={input}
          inputMode={isNumber ? "numeric" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example || (isNumber ? undefined : undefined)}
        />
      )}
    </div>
  );
}
