/** Native clip lengths supported by the configured video generators. */
export const VIDEO_DURATIONS = Array.from({ length: 29 }, (_, index) => index + 2);

export function videoDuration(prompt: string, explicit?: unknown): number {
  const match = prompt.match(/\b(\d+(?:\.\d+)?)\s*[- ]?\s*(seconds?|secs?|s|minutes?|mins?)\b/i);
  const duration = explicit != null ? Number(explicit)
    : match ? Number(match[1]) * (/^min/i.test(match[2]) ? 60 : 1) : 5;
  if (!Number.isInteger(duration) || duration < 2 || duration > 30) {
    throw new Error("Choose a video length from 2 to 30 whole seconds. Longer videos need multiple clips in the Asset Composer.");
  }
  return duration;
}
