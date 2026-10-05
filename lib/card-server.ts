import { getDb } from './db';
import type { Project } from './project';
import { cardTransition, freshCardState, publicCardState, type CardAction, type CardState } from './question-cards';
let schema:Promise<unknown>|null=null;
export async function ensureCards(db:NonNullable<ReturnType<typeof getDb>>){if(!schema)schema=db`CREATE TABLE IF NOT EXISTS live_cards (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, PRIMARY KEY(project_id,tool_id))`.catch(e=>{schema=null;throw e;});await schema;}
export async function readCards(db:NonNullable<ReturnType<typeof getDb>>,project:Project,privateView=false){
 await ensureCards(db);const rows=await db`SELECT tool_id,data FROM live_cards WHERE project_id=${project.id}`;
 return Object.fromEntries(rows.flatMap(row=>{const tool=project.gameTools.find(t=>t.id===row.tool_id&&t.enabled);return tool?[[row.tool_id,privateView?row.data:publicCardState(project,tool,row.data as CardState)]]:[];}));
}
export async function changeCard(db:NonNullable<ReturnType<typeof getDb>>,project:Project,toolId:string,action:CardAction,expectedVersion?:number,text=''){
 const tool=project.gameTools.find(t=>t.id===toolId&&t.enabled&&t.inOverlayBuild&&(t.type==='question-card'||t.type==='blank-card'));
 if(!tool)throw new Error('This card system is not connected in the published project.');
 await ensureCards(db);const empty=JSON.stringify(freshCardState());
 await db`INSERT INTO live_cards(project_id,tool_id,data) VALUES(${project.id},${toolId},${empty}::jsonb) ON CONFLICT DO NOTHING`;
 const rows=await db`SELECT version,data FROM live_cards WHERE project_id=${project.id} AND tool_id=${toolId}`;
 const previous=rows[0].data as CardState;
 if(expectedVersion!==undefined&&expectedVersion!==Number(rows[0].version))throw new Error('The active question changed. Refresh the card controls and try again.');
 const next=cardTransition(project,tool,previous,action,Date.now(),Math.random,text);
 const json=JSON.stringify(next);
 const updated=await db`UPDATE live_cards SET data=${json}::jsonb,version=${next.version} WHERE project_id=${project.id} AND tool_id=${toolId} AND version=${previous.version} RETURNING data`;
 if(!updated.length)throw new Error('Another question action just finished. Try again from the current question.');
 return next;
}
