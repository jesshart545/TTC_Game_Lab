import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import type { YouTubeVideo } from "./youtube";

export async function validLiveHost(db: NonNullable<ReturnType<typeof getDb>>, projectId: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) return false;
  await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  const hosts = await db`SELECT token_hash FROM live_hosts WHERE project_id = ${projectId}`;
  const expected = String(hosts[0]?.token_hash || "");
  const actual = createHash("sha256").update(key).digest("hex");
  return /^[a-f0-9]{64}$/.test(expected) && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
function apiKey() { return (process.env.YOUTUBE_API_KEY || "").trim(); }
export function youtubeSearchConfigured() { return Boolean(apiKey()); }
async function youtubeApi(resource: string, params: Record<string, string>) {
  const key = apiKey();
  if (!key) throw new Error("YouTube search is not connected yet. The site administrator needs to configure YOUTUBE_API_KEY with YouTube Data API v3 enabled. You can still check a YouTube link.");
  const query = new URLSearchParams({ ...params, key });
  const response = await fetch("https://www.googleapis.com/youtube/v3/" + resource + "?" + query, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    throw new Error(reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? "YouTube search has reached its daily allowance. Try again later."
      : reason === "accessNotConfigured" ? "The site administrator needs to enable YouTube Data API v3 for the search key."
      : "YouTube could not complete this request. Check the search connection or try again.");
  }
  return data;
}
function usable(item: any, region: string) {
  const restrictions = item.contentDetails?.regionRestriction;
  return item.status?.embeddable === true && item.status?.privacyStatus === "public"
    && item.status?.uploadStatus === "processed" && item.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted"
    && (!restrictions?.blocked?.includes(region)) && (!restrictions?.allowed || restrictions.allowed.includes(region))
    && item.snippet?.liveBroadcastContent !== "upcoming";
}
function video(item: any): YouTubeVideo {
  return { id: String(item.id), title: String(item.snippet?.title || "YouTube video"), channel: String(item.snippet?.channelTitle || ""),
    thumbnail: String(item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "") };
}
export async function searchYoutube(query: string, region: string): Promise<YouTubeVideo[]> {
  const search = await youtubeApi("search", { part: "snippet", type: "video", q: query, maxResults: "12", videoEmbeddable: "true", videoSyndicated: "true", regionCode: region, safeSearch: "moderate" });
  const ids = (search.items || []).map((item: any) => item.id?.videoId).filter((id: unknown) => typeof id === "string" && /^[\w-]{11}$/.test(id as string));
  if (!ids.length) return [];
  const details = await youtubeApi("videos", { part: "snippet,status,contentDetails", id: ids.join(",") });
  return (details.items || []).filter((item: any) => usable(item, region)).map(video);
}
export async function verifyYoutube(id: string, region: string): Promise<YouTubeVideo> {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("Choose a valid YouTube video.");
  if (apiKey()) {
    const data = await youtubeApi("videos", { part: "snippet,status,contentDetails", id });
    const item = data.items?.[0];
    if (!item || !usable(item, region)) throw new Error("This video cannot be embedded here. Choose another video.");
    return video(item);
  }
  // YouTube's oEmbed response confirms a permitted embed for manually supplied links.
  const response = await fetch("https://www.youtube.com/oembed?" + new URLSearchParams({ url: "https://www.youtube.com/watch?v=" + id, format: "json" }), { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("YouTube did not allow this video to be embedded. Choose another video.");
  const data = await response.json();
  if (!String(data.html || "").includes("/embed/" + id)) throw new Error("YouTube did not confirm an embeddable player.");
  return { id, title: String(data.title || "YouTube video"), channel: String(data.author_name || ""), thumbnail: String(data.thumbnail_url || "") };
}
