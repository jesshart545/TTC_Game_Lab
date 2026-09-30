import { NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { getDb } from "../../../../lib/db";
import { ASSET_BUCKET, getAssetStorage, putAsset, getAssetUrl, deleteAssetsByPrefix } from "../../../../lib/object-storage";
import { CHUNK_BYTES, MAX_ASSET_BYTES, signUpload, verifyUpload, partCount, partSize, type UploadTicket } from "../../../../lib/asset-upload";
export const runtime="nodejs";
export const maxDuration=300;
function safeName(name:string) { return name.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160) || "asset"; }
function prefix(ticket:UploadTicket) { return "uploads/"+ticket.uploadId+"/"; }
function finalKey(ticket:UploadTicket) { return "projects/"+ticket.projectId+"/"+ticket.uploadId+"-"+safeName(ticket.name); }
async function result(ticket:UploadTicket) {
  const key=finalKey(ticket);
  return NextResponse.json({name:ticket.name,type:ticket.type,storageKey:key,url:await getAssetUrl(key)});
}
export async function POST(request:Request) {
  const user=await requireCreator();
  if(!user) return NextResponse.json({error:"Please sign in to save media."},{status:401});
  if(request.headers.get("origin")!==new URL(request.url).origin) return NextResponse.json({error:"Invalid upload origin."},{status:403});
  try {
    if((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form=await request.formData();
      const ticket=verifyUpload(String(form.get("token") || ""),user.id);
      const index=Number(form.get("index"));
      const file=form.get("file");
      if(!(file instanceof File) || file.size!==partSize(ticket,index)) return NextResponse.json({error:"Upload part is incomplete."},{status:400});
      await putAsset(prefix(ticket)+index,new Uint8Array(await file.arrayBuffer()),"application/octet-stream");
      return NextResponse.json({saved:true,index});
    }
    const body=await request.json();
    if(body.action==="start") {
      const projectId=String(body.projectId || "");
      const size=Number(body.size);
      if(!/^[a-zA-Z0-9_-]+$/.test(projectId) || !Number.isSafeInteger(size) || size<1 || size>MAX_ASSET_BYTES) return NextResponse.json({error:"Media must be between 1 byte and 256 MB."},{status:400});
      const db=getDb();
      if(!db) return NextResponse.json({error:"Project storage is unavailable."},{status:503});
      const projects=await db`SELECT id FROM projects WHERE id=${projectId} AND (owner_id=${user.id} OR ${isAdmin(user)}) LIMIT 1`;
      if(!projects.length) return NextResponse.json({error:"Project not found."},{status:404});
      const ticket:UploadTicket={userId:user.id,projectId,uploadId:crypto.randomUUID(),name:String(body.name || "Generated media").slice(0,160),type:String(body.type || "application/octet-stream").slice(0,100),size,expires:Date.now()+3600000};
      return NextResponse.json({token:signUpload(ticket),chunkBytes:CHUNK_BYTES});
    }
    const ticket=verifyUpload(String(body.token || ""),user.id);
    if(body.action==="cancel") { await deleteAssetsByPrefix(prefix(ticket)); return NextResponse.json({cancelled:true}); }
    if(body.action!=="complete") return NextResponse.json({error:"Invalid upload action."},{status:400});
    const storage=getAssetStorage();
    try {
      const saved=await storage.send(new HeadObjectCommand({Bucket:ASSET_BUCKET,Key:finalKey(ticket)}));
      if(saved.ContentLength===ticket.size) return result(ticket);
    } catch {}
    const bytes=new Uint8Array(ticket.size);
    for(let index=0;index<partCount(ticket);index++) {
      const part=await storage.send(new GetObjectCommand({Bucket:ASSET_BUCKET,Key:prefix(ticket)+index}));
      if(!part.Body || part.ContentLength!==partSize(ticket,index)) throw new Error("An upload part is missing. Please retry saving the media.");
      const value=await part.Body.transformToByteArray();
      if(value.length!==partSize(ticket,index)) throw new Error("An upload part is incomplete.");
      bytes.set(value,index*CHUNK_BYTES);
    }
    await putAsset(finalKey(ticket),bytes,ticket.type);
    await deleteAssetsByPrefix(prefix(ticket)).catch(()=>{});
    return result(ticket);
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Could not save media."},{status:400});
  }
}
