import { createHmac, timingSafeEqual } from "node:crypto";
export const CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_ASSET_BYTES = 256 * 1024 * 1024;
export type UploadTicket = { userId:string; projectId:string; uploadId:string; name:string; type:string; size:number; expires:number };
function secret() { const value=process.env.NEON_AUTH_COOKIE_SECRET; if(!value) throw new Error("Upload signing is unavailable."); return value; }
export function signUpload(ticket:UploadTicket) {
  const payload=Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return payload+"."+createHmac("sha256",secret()).update(payload).digest("base64url");
}
export function verifyUpload(token:string,userId:string):UploadTicket {
  const parts=token.split(".");
  if(parts.length!==2 || token.length>4000) throw new Error("Invalid upload session.");
  const expected=createHmac("sha256",secret()).update(parts[0]).digest();
  const actual=Buffer.from(parts[1],"base64url");
  if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw new Error("Invalid upload session.");
  const ticket=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as UploadTicket;
  if(ticket.userId!==userId || ticket.expires<Date.now() || !Number.isSafeInteger(ticket.size) || ticket.size<1 || ticket.size>MAX_ASSET_BYTES || !/^[a-f0-9-]{36}$/.test(ticket.uploadId)) throw new Error("Upload session expired or invalid.");
  return ticket;
}
export function partCount(ticket:UploadTicket) { return Math.ceil(ticket.size/CHUNK_BYTES); }
export function partSize(ticket:UploadTicket,index:number) {
  if(!Number.isInteger(index) || index<0 || index>=partCount(ticket)) throw new Error("Invalid upload part.");
  return Math.min(CHUNK_BYTES,ticket.size-index*CHUNK_BYTES);
}
