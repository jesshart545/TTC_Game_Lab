import { getDb } from './db';
import type { Project } from './project';
import { freshDjState, publicDjState, djTransition, deckTrackKeys, type DjAction, type DjState } from './dj-deck';
import { freshSoundBoardState, publicSoundBoardState, soundBoardTransition, type SoundBoardAction, type SoundBoardState } from './sound-board';

// The live audio tools' server store — the DJ Deck and the Sound
// Board (lib/bank-server.ts is the pattern). One table holds either
// state shape, keyed per project + tool; the shared lib modules do
// every transition, so the dashboard and the overlay read one truth.
// Unlike the Bank, a change does NOT require the tool to stand on
// the overlay build: a radio show's music must play from the overlay
// page even when the deck's face was never placed there — placement
// governs only the tools' visible faces, never their audio.

let schema: Promise<unknown> | null = null;
export async function ensureAudio(db: NonNullable<ReturnType<typeof getDb>>) { if (!schema) schema = db`CREATE TABLE IF NOT EXISTS live_audio_states (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, PRIMARY KEY(project_id,tool_id))`.catch(e => { schema = null; throw e; }); await schema; }

export type AudioStates = { decks: Record<string, DjState>; sounds: Record<string, SoundBoardState> };

export async function readAudioStates(db: NonNullable<ReturnType<typeof getDb>>, project: Project): Promise<AudioStates> {
  await ensureAudio(db); const rows = await db`SELECT tool_id,data FROM live_audio_states WHERE project_id=${project.id}`;
  const stored = new Map(rows.map(row => [row.tool_id as string, row.data]));
  // Every enabled audio tool reports a state (a fresh one until its
  // first action), so the dashboard and the overlay always render
  // from the same shape.
  const decks: Record<string, DjState> = {};
  const sounds: Record<string, SoundBoardState> = {};
  for (const tool of project.gameTools) {
    if (!tool.enabled) continue;
    if (tool.type === 'dj-deck') decks[tool.id] = publicDjState((stored.get(tool.id) as DjState | undefined) || freshDjState());
    if (tool.type === 'sound-board') sounds[tool.id] = publicSoundBoardState((stored.get(tool.id) as SoundBoardState | undefined) || freshSoundBoardState());
  }
  return { decks, sounds };
}

export async function resetAudioStates(db: NonNullable<ReturnType<typeof getDb>>, project: Project) {
  await ensureAudio(db); const rows = await db`SELECT tool_id FROM live_audio_states WHERE project_id=${project.id}`;
  const stored = new Set(rows.map(row => row.tool_id as string));
  const states = await readAudioStates(db, project);
  // A game reset stops the show's music and sounds where they stand
  // (the Bank's reset keeps its game; a song has no score to keep).
  // The faces' visibility is the creator's placement choice, not
  // playback, so it survives — the same split the Bank makes.
  for (const tool of project.gameTools) {
    if (!tool.enabled || !stored.has(tool.id)) continue;
    if (tool.type === 'dj-deck') {
      const previous = states.decks[tool.id];
      const next: DjState = { ...freshDjState(), visible: previous?.visible ?? false, version: (previous?.version ?? 0) + 1 };
      await db`UPDATE live_audio_states SET data=${JSON.stringify(next)}::jsonb,version=${next.version} WHERE project_id=${project.id} AND tool_id=${tool.id}`;
    }
    if (tool.type === 'sound-board') {
      const previous = states.sounds[tool.id];
      const next: SoundBoardState = { ...freshSoundBoardState(), visible: previous?.visible ?? false, version: (previous?.version ?? 0) + 1 };
      await db`UPDATE live_audio_states SET data=${JSON.stringify(next)}::jsonb,version=${next.version} WHERE project_id=${project.id} AND tool_id=${tool.id}`;
    }
  }
}

const DJ_ACTIONS: DjAction[] = ['play', 'pause', 'stop', 'next', 'previous', 'merge', 'play-track', 'toggle', 'fade-out', 'loop', 'speed'];
const SOUND_ACTIONS: SoundBoardAction[] = ['play-pad', 'stop-pad', 'toggle'];

export async function changeAudio(db: NonNullable<ReturnType<typeof getDb>>, project: Project, toolId: string, action: string, expectedVersion?: number, arg?: string) {
  const tool = project.gameTools.find(t => t.id === toolId && t.enabled && (t.type === 'dj-deck' || t.type === 'sound-board'));
  if (!tool) throw new Error('This audio tool is not part of the published project.');
  const isDeck = tool.type === 'dj-deck';
  if (isDeck && !DJ_ACTIONS.includes(action as DjAction)) throw new Error('Invalid deck action.');
  if (!isDeck && !SOUND_ACTIONS.includes(action as SoundBoardAction)) throw new Error('Invalid sound board action.');
  await ensureAudio(db); const empty = JSON.stringify(isDeck ? freshDjState() : freshSoundBoardState());
  await db`INSERT INTO live_audio_states(project_id,tool_id,data) VALUES(${project.id},${toolId},${empty}::jsonb) ON CONFLICT DO NOTHING`;
  const rows = await db`SELECT version,data FROM live_audio_states WHERE project_id=${project.id} AND tool_id=${toolId}`;
  const previous = rows[0].data as DjState & SoundBoardState;
  if (expectedVersion !== undefined && expectedVersion !== Number(rows[0].version)) throw new Error('The controls changed on another screen. Refresh and try again.');
  // The deck resolves its track list from the published project
  // itself at every action, so next/previous/merge always walk the
  // list the audience will actually hear.
  const next = isDeck
    ? djTransition(previous as DjState, action as DjAction, Date.now(), deckTrackKeys(project, tool), tool.config, arg)
    : soundBoardTransition(previous as SoundBoardState, action as SoundBoardAction, Date.now(), arg);
  const json = JSON.stringify(next);
  const updated = await db`UPDATE live_audio_states SET data=${json}::jsonb,version=${next.version} WHERE project_id=${project.id} AND tool_id=${toolId} AND version=${previous.version} RETURNING data`;
  if (!updated.length) throw new Error('Another action just finished. Try again from the current state.');
  return isDeck ? publicDjState(next as DjState) : publicSoundBoardState(next as SoundBoardState);
}
