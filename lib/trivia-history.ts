import { createHash } from "node:crypto";
import { getDb } from "./db";
export type TriviaIdentity = {question:string;answer?:string};
export function normalizeTrivia(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
const stop=new Set("a an the what which who when where how is was are were did does do of in on at to for by and it this that has have name named known called as".split(" "));
export function repeatedTrivia(candidate:TriviaIdentity,history:TriviaIdentity[]){
 const question=normalizeTrivia(candidate.question),answer=normalizeTrivia(candidate.answer||"");
 const words=new Set(question.split(" ").filter(w=>!stop.has(w)));
 return history.some(previous=>{
  const old=normalizeTrivia(previous.question);if(question===old)return true;
  if(!answer||answer!==normalizeTrivia(previous.answer||""))return false;
  const other=new Set(old.split(" ").filter(w=>!stop.has(w)));
  const common=[...words].filter(w=>other.has(w)).length;
  return common>=2&&common/Math.max(words.size,other.size)>=0.65;
 });
}
export async function triviaHistory(userId:string){
 const db=getDb();if(!db)throw new Error("Trivia history is unavailable. Please try again shortly.");
 await db`CREATE TABLE IF NOT EXISTS trivia_generation_history (user_id TEXT NOT NULL, question_key TEXT NOT NULL, question_text TEXT NOT NULL, answer_text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,question_key))`;
 const rows=await db`SELECT question_text,answer_text FROM trivia_generation_history WHERE user_id=${userId} ORDER BY created_at ASC`;
 const history:TriviaIdentity[]=rows.map(r=>({question:String(r.question_text),answer:String(r.answer_text)}));
 return {history,async claim(question:TriviaIdentity){
  if(repeatedTrivia(question,history))return false;
  const key=createHash("sha256").update(normalizeTrivia(question.question)).digest("hex");
  const rows=await db`INSERT INTO trivia_generation_history (user_id,question_key,question_text,answer_text) VALUES (${userId},${key},${question.question},${question.answer||""}) ON CONFLICT DO NOTHING RETURNING question_key`;
  if(!rows.length)return false;history.push(question);return true;
 }};
}
