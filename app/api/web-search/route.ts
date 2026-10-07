import { NextResponse } from "next/server";
import { requireCreator } from "../../../lib/auth/server";
import { getDb } from "../../../lib/db";
import { validLiveHost } from "../../../lib/youtube-server";
import { webResults } from "../../../lib/web-search";
export const maxDuration=30;
export async function POST(request:Request){
  const body=await request.json().catch(()=>null);const q=typeof body?.q==="string"?body.q.trim():"";
  if(!q||q.length>200)return NextResponse.json({error:"Enter a search from 1 to 200 characters."},{status:400});
  const db=getDb();if(!db)return NextResponse.json({error:"Search is temporarily unavailable."},{status:503});
  let identity="";const key=request.headers.get("x-host-key");
  if(key&&typeof body.slug==="string"){
    const rows=await db`SELECT id FROM projects WHERE slug=${body.slug} LIMIT 1`;
    if(rows[0]&&await validLiveHost(db,String(rows[0].id),key))identity=`host:${rows[0].id}`;
  }else{const user=await requireCreator();if(user)identity=`user:${user.id}`;}
  if(!identity)return NextResponse.json({error:"Sign in or open your private dashboard to search."},{status:401});
  const base=process.env.SEARCH_INTERNAL_URL;
  if(!base)return NextResponse.json({error:"Embedded search is not available in this deployment yet."},{status:503});
  try{
    await db`CREATE TABLE IF NOT EXISTS web_search_limits (identity TEXT PRIMARY KEY, window_start BIGINT NOT NULL, count INTEGER NOT NULL)`;
    const windowStart=Math.floor(Date.now()/60000)*60000;
    const limits=await db`INSERT INTO web_search_limits (identity,window_start,count) VALUES (${identity},${windowStart},1) ON CONFLICT (identity) DO UPDATE SET count=CASE WHEN web_search_limits.window_start=${windowStart} THEN web_search_limits.count+1 ELSE 1 END, window_start=${windowStart} RETURNING count`;
    if(Number(limits[0].count)>20)return NextResponse.json({error:"Please wait a minute before searching again."},{status:429,headers:{"Retry-After":"60"}});
    const url=new URL("/search",base);url.search=new URLSearchParams({q,format:"json",categories:"general",language:"en-US",safesearch:"1"}).toString();
    const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(18000),headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Search provider returned ${response.status}`);
    const data=await response.json();const results=webResults(data.results);
    if(!results.length&&data.unresponsive_engines?.length)throw new Error("Search engines unavailable");
    return NextResponse.json({results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("Web search request failed",error instanceof Error?error.name:"Unknown error");return NextResponse.json({error:"Search is temporarily unavailable. Your previous results are still here; try again shortly."},{status:502});}
}
