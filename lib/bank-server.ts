import { getDb } from './db';
import type { Project } from './project';
import { bankTransition, freshBankState, publicBankState, type BankAction, type BankState } from './bank';
let schema: Promise<unknown> | null = null;
export async function ensureBank(db: NonNullable<ReturnType<typeof getDb>>) { if (!schema) schema = db`CREATE TABLE IF NOT EXISTS live_bank_states (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, PRIMARY KEY(project_id,tool_id))`.catch(e => { schema = null; throw e; }); await schema; }
export async function readBankStates(db: NonNullable<ReturnType<typeof getDb>>, project: Project) {
  await ensureBank(db); const rows = await db`SELECT tool_id,data FROM live_bank_states WHERE project_id=${project.id}`;
  const stored = new Map(rows.map(row => [row.tool_id as string, row.data as BankState]));
  // Every enabled Bank tool reports a state (a fresh one until its first
  // action), settled at read time so the dashboard and the overlay see the
  // same round-expiry clear.
  return Object.fromEntries(project.gameTools.filter(t => t.type === 'bank' && t.enabled).map(tool => [tool.id, publicBankState(stored.get(tool.id) || freshBankState(tool.config), Date.now())]));
}
export async function changeBank(db: NonNullable<ReturnType<typeof getDb>>, project: Project, toolId: string, action: BankAction, expectedVersion?: number, pressValue?: unknown) {
  const tool = project.gameTools.find(t => t.id === toolId && t.enabled && t.inOverlayBuild && t.type === 'bank');
  if (!tool) throw new Error('This bank is not connected in the published project.');
  await ensureBank(db); const empty = JSON.stringify(freshBankState(tool.config));
  await db`INSERT INTO live_bank_states(project_id,tool_id,data) VALUES(${project.id},${toolId},${empty}::jsonb) ON CONFLICT DO NOTHING`;
  const rows = await db`SELECT version,data FROM live_bank_states WHERE project_id=${project.id} AND tool_id=${toolId}`;
  const previous = rows[0].data as BankState;
  if (expectedVersion !== undefined && expectedVersion !== Number(rows[0].version)) throw new Error('The bank changed on another screen. Refresh the bank controls and try again.');
  // The round length is the tool's setting, read fresh at every round
  // start; a start with no explicit press value falls back to the tool's
  // saved starting press value.
  const next = bankTransition(previous, action, Date.now(), { pressValue: pressValue !== undefined ? pressValue : (action === 'start' ? tool.config.pressValue : undefined), roundSeconds: tool.config.roundSeconds });
  const json = JSON.stringify(next);
  const updated = await db`UPDATE live_bank_states SET data=${json}::jsonb,version=${next.version} WHERE project_id=${project.id} AND tool_id=${toolId} AND version=${previous.version} RETURNING data`;
  if (!updated.length) throw new Error('Another bank action just finished. Try again from the current bank.');
  return publicBankState(next, Date.now());
}
