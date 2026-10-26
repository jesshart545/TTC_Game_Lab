/**
 * Polling for a submitted video edit's result, shared by the project page's
 * layered-edit runner and the media editor.
 *
 * A render can run for many minutes while the client checks its status every
 * few seconds. A single check can fail for reasons that have nothing to do
 * with the render itself — a transient network drop, a connection reset, the
 * 30-second abort, a momentary 5xx — and the render usually completes fine on
 * the provider side. Those transient failures are tolerated: polling only
 * gives up after MAX_CONSECUTIVE_POLL_FAILURES of them in a row. Genuine
 * terminal answers behave exactly as they always have: a failed job throws at
 * once, a non-retryable HTTP status throws at once, and a job that is still
 * processing when the deadline passes throws the still-processing message.
 */

/** How many poll failures in a row are tolerated before the edit is given up as unreachable. */
export const MAX_CONSECUTIVE_POLL_FAILURES = 10;

export interface VideoEditPollMessages {
  /** Shown when the status endpoint itself cannot be reached (repeatedly, or via a non-retryable status). */
  progress: string;
  /** Shown when the provider reports the edit job failed. */
  failed: string;
  /** Shown when the job is still processing at the deadline. */
  stillProcessing: string;
}

const DEFAULT_MESSAGES: VideoEditPollMessages = {
  progress: "Unable to check video editing progress.",
  failed: "Video editing failed.",
  stillProcessing: "Video editing is still processing. Please try again in a little while.",
};

/** The slice of a fetch Response the poller reads. */
export interface VideoEditPollResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

export type VideoEditPollFetch = (
  url: string,
  init: { cache: "no-store"; signal: AbortSignal },
) => Promise<VideoEditPollResponse>;

export interface VideoEditPollOptions {
  /** Performs one status request; defaults to the same status fetch both call sites used inline. */
  fetchImpl?: VideoEditPollFetch;
  /** Waits between checks; defaults to a setTimeout promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock; defaults to Date.now. */
  now?: () => number;
  /** Overall wait budget before the still-processing error; defaults to 60 minutes. */
  deadlineMs?: number;
  /** Delay between checks; defaults to 3000ms. */
  pollIntervalMs?: number;
  /** Overrides for any of the user-facing error messages. */
  messages?: Partial<VideoEditPollMessages>;
}

/**
 * Polls GET /api/generate-asset/status for a submitted video edit until the
 * provider returns the finished video URL, and resolves with that URL.
 * Throws an Error carrying the appropriate message for every terminal
 * outcome: the job failed, the status endpoint stayed unreachable through
 * MAX_CONSECUTIVE_POLL_FAILURES consecutive transient failures, the endpoint
 * answered a non-retryable HTTP status, or the deadline passed.
 */
export async function pollForEditedVideoUrl(
  videoId: string,
  model: string,
  options: VideoEditPollOptions = {},
): Promise<string> {
  const fetchImpl: VideoEditPollFetch = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const deadlineMs = options.deadlineMs ?? 60 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const messages: VideoEditPollMessages = { ...DEFAULT_MESSAGES, ...(options.messages ?? {}) };
  const statusUrl = `/api/generate-asset/status?id=${encodeURIComponent(videoId)}&model=${encodeURIComponent(model)}&provider=fal`;
  const deadline = now() + deadlineMs;
  let consecutiveFailures = 0;
  let firstCheck = true;
  while (now() < deadline) {
    if (!firstCheck) await sleep(pollIntervalMs);
    firstCheck = false;
    let statusResponse: VideoEditPollResponse;
    try {
      statusResponse = await fetchImpl(statusUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    } catch {
      // Network-level failure (drop, reset, abort): the render is almost
      // certainly still running provider-side, so tolerate it and poll on.
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) throw new Error(messages.progress);
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
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) throw new Error(statusData.error || messages.progress);
      continue;
    }
    consecutiveFailures = 0;
    if (statusData.status === "failed" || statusData.status === "error") throw new Error(statusData.error || messages.failed);
    if (statusData.status === "completed" && statusData.url) return String(statusData.url);
  }
  throw new Error(messages.stillProcessing);
}
