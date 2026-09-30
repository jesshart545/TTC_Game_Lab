import { NextResponse } from "next/server";
import { getDb } from "../../../../../../lib/db";
import type { Project } from "../../../../../../lib/project";
import { randomUUID } from "node:crypto";
type Context={params:Promise<{slug:string;toolId:string}>};
async function poll(request:Request,context:Context) {
 const {slug,toolId}=await context.params;
 const db=getDb();if(!db)return null;
 const rows=await db`SELECT data FROM projects WHERE slug=${slug} LIMIT 1`;
 const p=(rows[0]?.data as Project|undefined)?.publishedSnapshot;
 const tool=p?.gameTools.find(t=>t.id===toolId && t.enabled && t.inToolbox && t.type==="poll");
 const controlId=new URL(request.url).searchParams.get("control") || "";
 const control=p?.controls.find(c=>c.id===controlId && c.toolIds?.includes(toolId));
 if(!p || !tool || !control)return null;
 const events=await db`SELECT id FROM live_events WHERE project_id=${p.id} AND control_id=${controlId} AND event_type='control' ORDER BY id DESC LIMIT 1`;
 if(!events[0])return null;
 await db`CREATE TABLE IF NOT EXISTS live_poll_votes (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, event_id BIGINT NOT NULL, visitor_id TEXT NOT NULL, option_index INTEGER NOT NULL, PRIMARY KEY(project_id,tool_id,event_id,visitor_id))`;
 return {db,p,tool,eventId:Number(events[0].id)};
}
function visitor(request:Request) {
 const cookie=request.headers.get("cookie") || "";
 const value=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("ttc-poll-visitor="))?.slice("ttc-poll-visitor=".length);
 return value && /^[a-f0-9-]{36}$/.test(value) ? value : "";
}
async function totals(live:NonNullable<Awaited<ReturnType<typeof poll>>>,id:string) {
 const rows=await live.db`SELECT option_index, COUNT(*)::int AS votes FROM live_poll_votes WHERE project_id=${live.p.id} AND tool_id=${live.tool.id} AND event_id=${live.eventId} GROUP BY option_index`;
 const mine=id ? await live.db`SELECT option_index FROM live_poll_votes WHERE project_id=${live.p.id} AND tool_id=${live.tool.id} AND event_id=${live.eventId} AND visitor_id=${id}` : [];
 return {eventId:live.eventId,counts:rows.map(row=>({option:Number(row.option_index),votes:Number(row.votes)})),voted:mine.length ? Number(mine[0].option_index) : null};
}
export async function GET(request:Request,context:Context) {
 const live=await poll(request,context);
 if(!live)return NextResponse.json({error:"Poll has not been started by the host."},{status:404});
 return NextResponse.json(await totals(live,visitor(request)),{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,context:Context) {
 const live=await poll(request,context);
 if(!live)return NextResponse.json({error:"Poll has not been started by the host."},{status:404});
 const body=await request.json().catch(()=>({}));
 const options=Array.isArray(live.tool.config.options)?live.tool.config.options:[];
 if(!Number.isInteger(body.option) || body.option<0 || body.option>=options.length || body.eventId!==live.eventId)return NextResponse.json({error:"This poll round has changed. Try again."},{status:400});
 const id=visitor(request) || randomUUID();
 await live.db`INSERT INTO live_poll_votes(project_id,tool_id,event_id,visitor_id,option_index) VALUES(${live.p.id},${live.tool.id},${live.eventId},${id},${body.option}) ON CONFLICT DO NOTHING`;
 const response=NextResponse.json(await totals(live,id),{headers:{"Cache-Control":"no-store"}});
 response.cookies.set("ttc-poll-visitor",id,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:86400*30});
 return response;
}
