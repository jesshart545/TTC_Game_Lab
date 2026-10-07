import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import type { Project } from '../../../../../lib/project';
import { validLiveHost } from '../../../../../lib/youtube-server';
import { changeCard, readCards } from '../../../../../lib/card-server';
import type { CardAction } from '../../../../../lib/question-cards';
type Context={params:Promise<{slug:string}>};
async function published(slug:string){const db=getDb();if(!db)return null;const rows=await db`SELECT data FROM projects WHERE slug=${slug} LIMIT 1`;const project=(rows[0]?.data as Project|undefined)?.publishedSnapshot;return project?{db,project}:null;}
export async function GET(request:Request,context:Context){
 const {slug}=await context.params;const live=await published(slug);if(!live)return NextResponse.json({error:'Published project unavailable.'},{status:404});
 const key=request.headers.get('x-host-key');const privateView=key?await validLiveHost(live.db,live.project.id,key):false;
 if(key&&!privateView)return NextResponse.json({error:'Open the private dashboard from the builder.'},{status:403});
 return NextResponse.json({states:await readCards(live.db,live.project,privateView)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,context:Context){
 const {slug}=await context.params;const live=await published(slug);if(!live)return NextResponse.json({error:'Published project unavailable.'},{status:404});
 if(!await validLiveHost(live.db,live.project.id,request.headers.get('x-host-key')||''))return NextResponse.json({error:'Open the private host dashboard from the builder.'},{status:403});
 const body=await request.json().catch(()=>({}));
 if(!['toggle','score','award','draw','show','turn','steal','reveal','clear','new-game','blank'].includes(body.action))return NextResponse.json({error:'Invalid card action.'},{status:400});
 if(body.version!==undefined&&(!Number.isSafeInteger(body.version)||body.version<0))return NextResponse.json({error:'Invalid question version.'},{status:400});
 try{return NextResponse.json({state:await changeCard(live.db,live.project,String(body.toolId),body.action as CardAction,body.version,String(body.text||''))});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Card action failed.'},{status:409});}
}

