import {NextResponse} from 'next/server';
import {requireCreator,isAdmin} from '../../../../lib/auth/server';
import {getDb} from '../../../../lib/db';

export async function GET(){
 const user=await requireCreator();
 if(!user||!isAdmin(user))return NextResponse.json({error:'Admin access required.'},{status:403});
 const db=getDb();
 if(!db)return NextResponse.json({error:'User list is unavailable right now. Please try again later.'},{status:503});
 try{
  const rows=await db`SELECT id,email,name,created_at FROM neon_auth.user ORDER BY created_at DESC LIMIT 500`;
  return NextResponse.json({users:rows.map((r:any)=>({id:String(r.id),email:String(r.email||''),name:r.name?String(r.name):null,createdAt:r.created_at?new Date(r.created_at).toISOString():null}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('[admin/users] query failed:', e instanceof Error ? e.message : e);
  return NextResponse.json({error:'User list could not be loaded.'},{status:503});
 }
}
