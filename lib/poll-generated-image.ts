/**
 * Polling for a submitted image generation's result, with the same hardening
 * as the video pollers (lib/video-edit-poll.ts, lib/video-generation.ts): an
 * image job can run for minutes while the client checks its status every few
 * seconds, and a single check can fail for reasons that have nothing to do
 * with the render itself — a transient network drop, a connection reset, a
 * 30-second abort, a momentary 5xx. Those transient failures are tolerated:
 * the wait only gives up after MAX_CONSECUTIVE_IMAGE_POLL_FAILURES of them in
 * a row, or when the deadline passes. Genuine terminal answers behave
 * strictly: a failed job throws at once, a non-retryable HTTP status throws
 * at once, and a job still processing at the deadline throws the
 * still-processing message.
 *
 * This replaces the older attempt-capped poller (lib/poll-image-generation.ts)
 * for new call sites; it speaks to the same status endpoint,
 * GET /api/generate-asset/image-status.
 */

/** How many poll failures in a row are tolerated before the wait is given up as unreachable. */
export const MAX_CONSECUTIVE_IMAGE_POLL_FAILURES = 10;

export interface GeneratedImagePollMessages {
  /** Shown when the status endpoint itself cannot be reached (repeatedly, or via a non-retryable status). */
  progress: string;
  /** Shown when the provider reports the image job failed. */
  failed: string;
  /** Shown when the job is still processing at the deadline. */
  stillProcessing: string;
}

const DEFAULT_MESSAGES: GeneratedImagePollMessages = {
  progress: "Unable to check image generation progress.",
  failed: "Image generation failed.",
  stillProcessing: "Image generation is still processing. Please try again in a little while.",
};

/** The slice of a fetch Response the poller reads. */
export interface GeneratedImagePollResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

export type GeneratedImagePollFetch = (
  url: string,
  init: { cache: "no-store"; signal: AbortSignal },
) => Promise<GeneratedImagePollResponse>;

export interface GeneratedImagePollOptions {
  /** Performs one status request; defaults to the browser fetch. */
  fetchImpl?: GeneratedImagePollFetch;
  /** Waits between checks; defaults to a setTimeout promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock; defaults to Date.now. */
  now?: () => number;
  /** Overall wait budget before the still-processing error; defaults to 60 minutes. */
  deadlineMs?: number;
  /** Delay between checks; defaults to 3000ms (the original image poller's interval). */
  pollIntervalMs?: number;
  /** Optional progress callback: queue position when the endpoint reports one, else null. */
  onProgress?: (queuePosition: number | null) => void;
  /** Overrides for any of the user-facing error messages. */
  messages?: Partial<GeneratedImagePollMessages>;
}

/**
 * Polls GET /api/generate-asset/image-status for a submitted image generation
 * until the provider returns the finished image URL, and resolves with that
 * URL. Throws an Error carrying the appropriate message for every terminal
 * outcome.
 */
export async function pollForGeneratedImageUrl(
  requestId: string,
  statusUrl: string,
  responseUrl: string,
  model: string,
  options: GeneratedImagePollOptions = {},
): Promise<string> {
  const fetchImpl: GeneratedImagePollFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const deadlineMs = options.deadlineMs ?? 60 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const messages: GeneratedImagePollMessages = { ...DEFAULT_MESSAGES, ...(options.messages ?? {}) };
  const url = `/api/generate-asset/image-status?id=${encodeURIComponent(requestId)}&statusUrl=${encodeURIComponent(statusUrl)}&responseUrl=${encodeURIComponent(responseUrl)}&model=${encodeURIComponent(model)}`;
  const deadline = now() + deadlineMs;
  let consecutiveFailures = 0;
  let firstCheck = true;
  while (now() < deadline) {
    if (!firstCheck) await sleep(pollIntervalMs);
    firstCheck = false;
    let statusResponse: GeneratedImagePollResponse;
    try {
      statusResponse = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    } catch {
      // Network-level failure (drop, reset, abort): the render is almost
      // certainly still running provider-side, so tolerate it and poll on.
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_IMAGE_POLL_FAILURES) throw new Error(messages.progress);
      continue;
    }
    const statusData: any = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      // 4xx (except 408/429) is a definitive answer about this request and
      // will not heal by retrying; anything else (5xx, 408, 429) may be a
      // momentary provider/gateway problem, so it counts as transient.
      const retryable = !(statusResponse.status >= 400 && statusResponse.status < 500)
        || statusResponse.status === 408
        || statusResponse.status === 429;
      if (!retryable) throw new Error(statusData.error || messages.progress);
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_IMAGE_POLL_FAILURES) throw new Error(statusData.error || messages.progress);
      continue;
    }
    consecutiveFailures = 0;
    if (statusData.status === "failed" || statusData.status === "error") throw new Error(statusData.error || messages.failed);
    if (statusData.status === "completed" && statusData.url) return String(statusData.url);
    if (statusData.status === "completed") throw new Error("The provider finished without an image URL.");
    options.onProgress?.(typeof statusData.queuePosition === "number" ? statusData.queuePosition : null);
  }
  throw new Error(messages.stillProcessing);
}
