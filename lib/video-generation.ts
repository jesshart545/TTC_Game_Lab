/**
 * Polling for a submitted video generation's result, used by the project
 * page's generate flow (both the initial wait and the "Check video result"
 * resume — the job is persisted in project.pendingVideos before polling
 * starts, so abandoning this wait never loses the job).
 *
 * This poller is at parity with the video-edit poller in
 * lib/video-edit-poll.ts: a render can run for many minutes while the
 * client checks its status every couple of seconds, and a single check
 * can fail for reasons that have
 * nothing to do with the render itself — a transient network drop, a
 * connection reset, the 30-second abort, a momentary 5xx. Those transient
 * failures are tolerated: the wait only gives up after
 * MAX_CONSECUTIVE_GENERATION_POLL_FAILURES of them in a row, or when the
 * 60-minute deadline passes. Genuine terminal answers behave exactly as they
 * always have: a failed job throws at once, a non-retryable HTTP status
 * throws at once, a job completed without a URL throws at once, and every
 * user-facing message is unchanged from the original attempt-capped poller.
 */

/** How many poll failures in a row are tolerated before the wait is given up as unreachable. */
export const MAX_CONSECUTIVE_GENERATION_POLL_FAILURES = 10;

const STATUS_UNREACHABLE_MESSAGE = "Video status could not be checked. Use Check video result to resume the saved request; do not generate another copy.";
const STILL_PROCESSING_MESSAGE = "The video is still processing. Use Check video result to resume the saved request; do not generate another copy.";

/** The slice of a fetch Response the poller reads. */
export interface GeneratedVideoPollResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

export type GeneratedVideoPollFetch = (
  url: string,
  init: { cache: "no-store"; signal: AbortSignal },
) => Promise<GeneratedVideoPollResponse>;

export interface GeneratedVideoPollOptions {
  /** Performs one status request; defaults to the same status fetch the caller used inline. */
  fetchImpl?: GeneratedVideoPollFetch;
  /** Waits between checks; defaults to a setTimeout promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock; defaults to Date.now. */
  now?: () => number;
  /** Overall wait budget before the still-processing error; defaults to 60 minutes. */
  deadlineMs?: number;
  /** Delay between checks; defaults to 2000ms (the original poller's interval). */
  pollIntervalMs?: number;
}

/**
 * Polls GET /api/generate-asset/status for a submitted video generation
 * until the provider returns the finished video URL, and resolves with that
 * URL. `onProgress` fires with every successful status response's progress
 * value, exactly as the original poller reported it. Throws an Error
 * carrying the appropriate (unchanged) message for every terminal outcome:
 * the job failed, the job finished without a URL, the status endpoint
 * stayed unreachable through MAX_CONSECUTIVE_GENERATION_POLL_FAILURES
 * consecutive transient failures, the endpoint answered a non-retryable
 * HTTP status, or the deadline passed with the job still processing.
 */
export async function waitForGeneratedVideo(
  videoId: string,
  model: string,
  onProgress?: (progress: number) => void,
  options: GeneratedVideoPollOptions = {},
): Promise<string> {
  const fetchImpl: GeneratedVideoPollFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const deadlineMs = options.deadlineMs ?? 60 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const provider = (model.startsWith("fal-ai/wan/") || model.startsWith("alibaba/wan-3.0/")) ? "fal" : model === "gen4.5" ? "runway" : "agnes";
  const statusUrl = `/api/generate-asset/status?id=${encodeURIComponent(videoId)}&model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider)}`;
  const deadline = now() + deadlineMs;
  let consecutiveFailures = 0;
  let firstCheck = true;
  while (now() < deadline) {
    if (!firstCheck) await sleep(pollIntervalMs);
    firstCheck = false;
    let response: GeneratedVideoPollResponse;
    try {
      response = await fetchImpl(statusUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    } catch {
      // Network-level failure (drop, reset, abort): the render is almost
      // certainly still running provider-side, so tolerate it and poll on.
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_GENERATION_POLL_FAILURES) throw new Error(STATUS_UNREACHABLE_MESSAGE);
      continue;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 4xx (except 408/429) is a definitive answer about this request and
      // will not heal by retrying; anything else (5xx, 408, 429) may be a
      // momentary provider/gateway problem, so it counts as transient.
      const retryable = !(response.status >= 400 && response.status < 500)
        || response.status === 408
        || response.status === 429;
      if (!retryable) throw new Error(payload?.error || "Unable to check video generation status.");
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_GENERATION_POLL_FAILURES) throw new Error(payload?.error || "Unable to check video generation status.");
      continue;
    }
    consecutiveFailures = 0;
    const progress = Number(payload?.progress || 0);
    onProgress?.(progress);
    if (payload?.status === "completed" && payload?.url) return String(payload.url);
    if (payload?.status === "completed") throw new Error("The provider finished without a video URL. Use Check video result to retry retrieval.");
    if (payload?.status === "failed" || payload?.status === "error") {
      throw new Error(payload?.error || "Video generation failed.");
    }
  }
  throw new Error(STILL_PROCESSING_MESSAGE);
}
