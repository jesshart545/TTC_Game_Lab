/**
 * Zip playlist planning (owner request, 2026-11-08): a creator drops a
 * .zip of songs on a project and the audio inside becomes a playlist —
 * the tracks are uploaded as ordinary audio assets and grouped into
 * one asset pool named after the zip.
 *
 * This module is the pure half of that flow: given the entry paths
 * inside a zip it decides which entries are songs, in what order they
 * play, what the skipped non-audio files count to, and what the pool
 * is called. The browser glue (fflate unzip + the uploads) lives in
 * the project page, so everything here is unit-testable without a
 * browser or a zip file.
 */

/** Audio file extensions accepted as playlist tracks, mapped to the
 * MIME type the stored asset carries (the type is what files an
 * upload into the library's audio folders). */
export const ZIP_AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  webm: "audio/webm",
};

const trackNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** The file name at the end of a zip entry path ("Album/01 Song.mp3" → "01 Song.mp3"). */
export function zipEntryBaseName(entryPath: string): string {
  const normalized = String(entryPath || "").replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** Directory entries carry no bytes and are never tracks. */
export function isZipDirectoryEntry(entryPath: string): boolean {
  return String(entryPath || "").endsWith("/");
}

/**
 * Hidden/system junk a zip picks up from the computer that made it:
 * macOS __MACOSX folders and AppleDouble "._" files, and dotfiles
 * such as .DS_Store. Junk is ignored entirely — it is not user
 * content, so it never counts as a skipped file either.
 */
export function isZipJunkEntry(entryPath: string): boolean {
  const segments = String(entryPath || "").replace(/\\/g, "/").split("/");
  if (segments.some(segment => segment === "__MACOSX")) return true;
  return zipEntryBaseName(entryPath).startsWith(".");
}

/** The lowercased extension of an entry's file name, or "" when it has none. */
export function zipEntryExtension(entryPath: string): string {
  const base = zipEntryBaseName(entryPath);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** The MIME type for an audio file name, or "" when it is not an accepted audio file. */
export function audioMimeTypeForName(name: string): string {
  return ZIP_AUDIO_MIME_BY_EXTENSION[zipEntryExtension(name)] || "";
}

/** True when the zip entry is a song: a real file, not junk, with an audio extension. */
export function isAudioZipEntry(entryPath: string): boolean {
  if (isZipDirectoryEntry(entryPath) || isZipJunkEntry(entryPath)) return false;
  return Boolean(audioMimeTypeForName(entryPath));
}

/**
 * Natural ordering for track names: compare by file name with
 * numeric collation, so "Track 2" sorts before "Track 10"; the full
 * entry path breaks ties between folders holding the same name.
 */
export function compareZipEntries(a: string, b: string): number {
  const byName = trackNameCollator.compare(zipEntryBaseName(a), zipEntryBaseName(b));
  return byName !== 0 ? byName : trackNameCollator.compare(a, b);
}

export type ZipPlaylistPlan = {
  /** Audio entry paths, in playlist (natural name) order. */
  tracks: string[];
  /** Real files that were left out because they are not audio. Junk and folders are not counted. */
  skipped: number;
};

/** Sort a zip's entries into the playlist: the audio tracks in order, plus the non-audio file count. */
export function planZipPlaylist(entryPaths: readonly string[]): ZipPlaylistPlan {
  const files = entryPaths.filter(path => !isZipDirectoryEntry(path) && !isZipJunkEntry(path));
  const tracks = files.filter(path => isAudioZipEntry(path)).sort(compareZipEntries);
  return { tracks, skipped: files.length - tracks.length };
}

/** True when a chosen file name is a zip archive. */
export function isZipFileName(name: string): boolean {
  return /\.zip$/i.test(zipEntryBaseName(String(name || "").trim()));
}

const MAX_POOL_NAME_LENGTH = 80;

/**
 * The pool name for a zip playlist: the zip's own name without the
 * .zip, de-duplicated against the pools a project already has the
 * way createAssetPool checks (trimmed, case-insensitive) — a second
 * "Road Trip.zip" becomes "Road Trip (2)", never an error.
 */
export function playlistPoolName(zipFileName: string, existingNames: readonly string[]): string {
  const base = zipEntryBaseName(String(zipFileName || "").trim()).replace(/\.zip$/i, "").trim() || "Playlist";
  const taken = new Set(existingNames.map(name => name.trim().toLowerCase()));
  const first = base.slice(0, MAX_POOL_NAME_LENGTH);
  if (!taken.has(first.toLowerCase())) return first;
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, MAX_POOL_NAME_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
