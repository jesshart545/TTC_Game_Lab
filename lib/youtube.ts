export type YouTubePlacement = { x: number; y: number; width: number; height: number };
export type YouTubeVideo = { id: string; title: string; channel: string; thumbnail: string; durationSeconds?: number | null; live?: boolean };
export type YouTubeState = {
  action: "play" | "pause" | "resume" | "stop"; videoId: string; title: string;
  start: number; end: number | null; position: number; at: number; volume: number;
  placement: YouTubePlacement; playbackId: string; durationSeconds?: number | null;
};
export function youtubeDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match || !match.slice(1).some(Boolean)) return null;
  const seconds = Number(match[1] || 0)*86400 + Number(match[2] || 0)*3600 + Number(match[3] || 0)*60 + Number(match[4] || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
export function formatYoutubeDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "Length unavailable";
  const total = Math.floor(value), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}` : `${minutes}:${String(seconds).padStart(2,"0")}`;
}
export const youtubePlacement: YouTubePlacement = { x: 10, y: 20, width: 80, height: 60 };
export function youtubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const id = host === "youtu.be" ? url.pathname.slice(1).split("/")[0]
      : ["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)
        ? url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(embed|shorts)\//.test(url.pathname) ? url.pathname.split("/")[2] : null
        : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export function clipTime(value: string): number | null {
  if (!value.trim()) return 0;
  if (!/^\d+(?::[0-5]?\d){0,2}(?:\.\d+)?$/.test(value.trim())) return null;
  return value.trim().split(":").reduce((total, part) => total * 60 + Number(part), 0);
}
export function youtubePosition(state: YouTubeState, now = Date.now()): number {
  const position = state.position + (state.action === "play" || state.action === "resume" ? Math.max(0, now - state.at) / 1000 : 0);
  return state.end === null ? position : Math.min(state.end, position);
}
export function safeYoutubePlacement(value: unknown): YouTubePlacement {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const number = (key: keyof YouTubePlacement, minimum: number, maximum: number) => {
    const n = Number(input[key] ?? youtubePlacement[key]);
    return Number.isFinite(n) ? Math.max(minimum, Math.min(maximum, n)) : youtubePlacement[key];
  };
  const width = number("width", 20, 100), height = number("height", 20, 100);
  return { width, height, x: number("x", 0, 100-width), y: number("y", 0, 100-height) };
}
