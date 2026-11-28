import type { CharacterProfile, Project, ProjectAsset } from "./project";

/**
 * The Character Studio: saved cast members for a project.
 *
 * A creator designs a character once — who they are, what they look
 * like, how they sound — and the character is filed in the project's
 * Characters collection: the profile (lib/project.ts CharacterProfile)
 * plus the ordinary project assets it points at (a portrait image, an
 * optional voice clip, and the video clips animated from the
 * portrait). The media stays plain assets with the site's usual
 * filing; the character is a library entry over them, never a
 * placement — creating or editing a character puts nothing on the
 * overlay, and a character's portrait or clips reach the stage only
 * the way any asset does, when the creator stages them.
 *
 * Jessica's rules for this feature (2026-11-28), which this module
 * exists to keep:
 * - NOTHING IS PRE-FILLED. Every field of a profile holds the
 *   creator's own words, drawn out of their description by Jewel's
 *   questions. The sanitizer below never injects a value the edit did
 *   not carry: no stock scene text, no house style, phase or outcome
 *   standing in for one the creator never named. Example looks and
 *   scene ideas live only in Jewel's conversation, as things she may
 *   offer in her own words when a creator is stuck — never as values
 *   in this code and never as silently applied defaults.
 * - Filing follows the site's creation discipline (the same one the
 *   tools follow): Jewel announces, the creator describes, Jewel
 *   creates and shows, the creator confirms, and only then is the
 *   character filed — the filing itself is the changes.characters
 *   edit and the generation attachments below.
 * - A creator's own uploaded image used as a portrait is used exactly
 *   as it is: the profile points at the uploaded asset, untouched.
 * - TWO INPUT CHANNELS ONLY (Jessica, 2026-11-28): a character is set
 *   up by (1) conversation — the PRIMARY input: the creator types a
 *   description of the character and its scenes to Jewel, and the
 *   profile is assembled from that conversation — and (2) image
 *   uploads, an OPTIONAL extra the creator may add: reference
 *   pictures, filed into the project like any upload and recorded on
 *   the profile (referenceKeys), which Jewel generates from through
 *   the ordinary image/video sourceKey paths. The flow is complete
 *   from a typed description alone; an upload is never required.
 *   There is no form-based setup for a character anywhere in this
 *   design.
 * - Jewel has no delete power here either (the same doctrine as
 *   assets): the creator removes a cast member from the Characters
 *   shelf in their library (removeCharacter below, called by that
 *   shelf). Removing a character removes the cast entry only — the
 *   portrait, voice and clips stay in the media library as the
 *   creator's own assets.
 */

const text = (value: unknown, limit: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : undefined;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The saved identity of an asset: its storageKey, or its name. */
export function assetKeyOf(asset: ProjectAsset): string {
  return asset.storageKey || asset.name;
}

/** The asset a saved key names in this project, if it is still there. */
export function assetByKey(project: Pick<Project, "assets">, key: string | undefined): ProjectAsset | undefined {
  if (!key) return undefined;
  return (project.assets || []).find(asset => assetKeyOf(asset) === key);
}

const PROFILE_TEXT_FIELDS = [
  ["name", 80],
  ["archetype", 200],
  ["details", 2000],
  ["bodyType", 200],
  ["mobilityAid", 200],
  ["artStyle", 200],
  ["voicePersona", 300],
  ["voiceDescription", 1000],
] as const;

/**
 * Clean one character profile patch: the text fields an edit actually
 * carries, each trimmed and length-capped, and nothing else. A field
 * the edit omits stays omitted — patching preserves the saved value,
 * and creating starts from the creator's words alone. There is
 * deliberately no defaulting anywhere in this function.
 */
export function cleanCharacterProfile(raw: unknown): Partial<CharacterProfile> {
  const input = record(raw);
  const out: Partial<CharacterProfile> = {};
  for (const [field, limit] of PROFILE_TEXT_FIELDS) {
    const value = text(input[field], limit);
    if (value !== undefined) out[field] = value;
  }
  if (typeof input.portraitKey === "string") out.portraitKey = input.portraitKey.slice(0, 300);
  if (Array.isArray(input.referenceKeys)) {
    out.referenceKeys = [...new Set(input.referenceKeys.filter((key): key is string => typeof key === "string").map(key => key.slice(0, 300)))].slice(0, 20);
  }
  if (typeof input.voiceKey === "string") out.voiceKey = input.voiceKey.slice(0, 300);
  if (Array.isArray(input.clipKeys)) {
    out.clipKeys = [...new Set(input.clipKeys.filter((key): key is string => typeof key === "string").map(key => key.slice(0, 300)))].slice(0, 100);
  }
  if (typeof input.clipKey === "string" && input.clipKey) (out as Record<string, unknown>).clipKey = input.clipKey.slice(0, 300);
  return out;
}

type CharacterPatch = Partial<CharacterProfile> & { clipKey?: string };

/** Keep only media keys that name a saved asset of the right kind in
 *  this project; an unknown or wrong-kind key is dropped, never
 *  invented or left dangling. Portraits must be images, voice keys
 *  audio, clip keys video — judged by the asset's own type/name the
 *  same way the library shelves judge them. */
function checkedMediaKey(project: Pick<Project, "assets">, key: string | undefined, kind: "image" | "audio" | "video"): string | undefined {
  if (!key) return undefined;
  const asset = assetByKey(project, key);
  if (!asset) return undefined;
  const type = (asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const isImage = type.includes("image") || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(name) || name.startsWith("image");
  const isVideo = type.includes("video") || /\.(mp4|mov|webm|m4v)$/i.test(name);
  const isAudio = type.includes("audio") || /\.(mp3|wav|m4a|aac|oga|ogg|flac)$/i.test(name) || /^(voice|music|sfx)/.test(name);
  if (kind === "image") return isImage && !isVideo ? key : undefined;
  if (kind === "video") return isVideo ? key : undefined;
  return isAudio ? key : undefined;
}

/**
 * Apply changes.characters edits to a project: an entry carrying the
 * id of a saved character patches that character (only the fields it
 * states change); an entry without an id creates a new character,
 * which requires at least the name the creator gave it — an unnamed
 * create is skipped whole rather than filed as a blank cast member.
 * Media keys are checked against the project's saved assets (see
 * checkedMediaKey). Returns the next roster and how many edits
 * actually landed.
 */
export function applyCharacterEdits(
  project: Pick<Project, "assets" | "characters">,
  edits: unknown,
): { characters: CharacterProfile[]; applied: number } {
  const characters: CharacterProfile[] = (project.characters || []).map(character => ({ ...character, clipKeys: character.clipKeys ? [...character.clipKeys] : undefined }));
  if (!Array.isArray(edits)) return { characters, applied: 0 };
  let applied = 0;
  const now = new Date().toISOString();
  for (const raw of edits) {
    const input = record(raw);
    const patch = cleanCharacterProfile(input) as CharacterPatch;
    const id = typeof input.id === "string" ? input.id : undefined;
    const existing = id ? characters.find(character => character.id === id) : undefined;
    if (id && !existing) continue; // an edit naming an unknown character changes nothing
    if (!existing && !patch.name) continue; // a character is born with the name its creator gave it
    const portraitKey = checkedMediaKey(project, patch.portraitKey, "image");
    const referenceKeys = patch.referenceKeys
      ? patch.referenceKeys.map(key => checkedMediaKey(project, key, "image")).filter((key): key is string => Boolean(key))
      : undefined;
    const voiceKey = checkedMediaKey(project, patch.voiceKey, "audio");
    const clipKeys = patch.clipKeys
      ? patch.clipKeys.map(key => checkedMediaKey(project, key, "video")).filter((key): key is string => Boolean(key))
      : undefined;
    if (existing) {
      const next: CharacterProfile = { ...existing };
      for (const [field] of PROFILE_TEXT_FIELDS) {
        if (patch[field] !== undefined) next[field] = patch[field] as string;
      }
      if (patch.portraitKey !== undefined && portraitKey) next.portraitKey = portraitKey;
      if (referenceKeys) next.referenceKeys = referenceKeys;
      if (patch.voiceKey !== undefined && voiceKey) next.voiceKey = voiceKey;
      if (clipKeys) next.clipKeys = clipKeys;
      if (patch.clipKey) {
        const clip = checkedMediaKey(project, patch.clipKey, "video");
        if (clip) next.clipKeys = [...new Set([...(next.clipKeys || []), clip])];
      }
      next.updatedAt = now;
      characters[characters.indexOf(existing)] = next;
      applied++;
    } else {
      characters.push({
        id: crypto.randomUUID(),
        name: patch.name as string,
        archetype: patch.archetype || "",
        details: patch.details || "",
        ...(patch.bodyType ? { bodyType: patch.bodyType } : {}),
        ...(patch.mobilityAid ? { mobilityAid: patch.mobilityAid } : {}),
        ...(patch.artStyle ? { artStyle: patch.artStyle } : {}),
        ...(patch.voicePersona ? { voicePersona: patch.voicePersona } : {}),
        ...(patch.voiceDescription ? { voiceDescription: patch.voiceDescription } : {}),
        ...(portraitKey ? { portraitKey } : {}),
        ...(referenceKeys && referenceKeys.length ? { referenceKeys } : {}),
        ...(voiceKey ? { voiceKey } : {}),
        ...(clipKeys && clipKeys.length ? { clipKeys } : {}),
        createdAt: now,
        updatedAt: now,
      });
      applied++;
    }
  }
  return { characters, applied };
}

/**
 * The creator removing a cast member from the Characters shelf: the
 * profile goes away; its portrait, voice and clips stay in the media
 * library untouched (they are the creator's assets, and other work
 * may use them). Returns the next roster.
 */
export function removeCharacter(project: Pick<Project, "characters">, characterId: string): CharacterProfile[] {
  return (project.characters || []).filter(character => character.id !== characterId);
}

/** One roster row for the library shelf: the profile with its saved
 *  media resolved to the assets themselves (undefined when a pointed
 *  asset is no longer in the project). */
export type CharacterRosterEntry = {
  character: CharacterProfile;
  portrait?: ProjectAsset;
  references: ProjectAsset[];
  voice?: ProjectAsset;
  clips: ProjectAsset[];
};

export function characterRoster(project: Pick<Project, "assets" | "characters">): CharacterRosterEntry[] {
  return (project.characters || []).map(character => ({
    character,
    portrait: assetByKey(project, character.portraitKey),
    references: (character.referenceKeys || []).map(key => assetByKey(project, key)).filter((asset): asset is ProjectAsset => Boolean(asset)),
    voice: assetByKey(project, character.voiceKey),
    clips: (character.clipKeys || []).map(key => assetByKey(project, key)).filter((asset): asset is ProjectAsset => Boolean(asset)),
  }));
}

/* ------------------------------------------------------------------ */
/* Generation attachments (the ccssAttach pattern, for characters)     */
/* ------------------------------------------------------------------ */

export type CharacterAttachField = "portrait" | "voice" | "clip";

/** Which generation action type a character field is filled by. */
export const CHARACTER_ATTACH_ACTION: Record<CharacterAttachField, "image" | "voice" | "video"> = {
  portrait: "image",
  voice: "voice",
  clip: "video",
};

export type CharacterAttach = {
  field: CharacterAttachField;
  /** The generation action type that must accompany this attachment. */
  actionType: "image" | "voice" | "video";
  /** Set when the media belongs to an already-saved character. */
  characterId?: string;
  /** Set when a portrait generation files a NEW character: the
   *  profile the creator agreed, cleaned — the character is created
   *  by the attachment itself once the portrait exists. */
  profile?: Partial<CharacterProfile>;
};

/**
 * Validate a characterAttach descriptor riding on a generation
 * action, against the actual draft: the field must be a real
 * character field; an existing character is named by its saved id
 * only; a new character arrives only with its portrait (a cast member
 * is born with the portrait its creator approved) and only with the
 * agreed profile, name included. Anything else is an error the
 * route's validation retry can correct — never a guess.
 */
export function checkedCharacterAttach(raw: unknown, project: Pick<Project, "characters"> | null | undefined): CharacterAttach {
  const input = record(raw);
  const field = input.field;
  if (field !== "portrait" && field !== "voice" && field !== "clip") {
    throw new Error("A character attachment needs field \"portrait\", \"voice\" or \"clip\".");
  }
  const actionType = CHARACTER_ATTACH_ACTION[field];
  const characterId = typeof input.characterId === "string" && input.characterId ? input.characterId : undefined;
  if (characterId) {
    if (!(project?.characters || []).some(character => character.id === characterId)) {
      throw new Error("That character attachment names a character that is not saved in this project. Use the exact saved character id from project.characters, or attach a profile to create the character with its portrait.");
    }
    return { field, actionType, characterId };
  }
  if (field !== "portrait") {
    throw new Error(`A character's ${field} can only be attached to a character that is already saved — name its characterId. A new character is created with its portrait.`);
  }
  const profile = cleanCharacterProfile(input.profile);
  if (!profile.name) {
    throw new Error("Creating a character with its portrait needs the agreed profile, with at least the character's name, in characterAttach.profile.");
  }
  return { field, actionType, profile };
}

/**
 * The changes that file a finished generation on its character, once
 * the media exists as a saved asset: a new character is created from
 * the agreed profile with the portrait set; a saved character gains
 * the portrait, voice or clip by key. Applied through the ordinary
 * changes pipeline (applyBuildChanges → applyCharacterEdits), so the
 * media keys are re-checked against the project's assets there.
 */
export function characterAttachPatch(attach: CharacterAttach, assetKey: string): { characters: Record<string, unknown>[] } {
  if (attach.characterId) {
    if (attach.field === "portrait") return { characters: [{ id: attach.characterId, portraitKey: assetKey }] };
    if (attach.field === "voice") return { characters: [{ id: attach.characterId, voiceKey: assetKey }] };
    return { characters: [{ id: attach.characterId, clipKey: assetKey }] };
  }
  return { characters: [{ ...(attach.profile || {}), portraitKey: assetKey }] };
}
