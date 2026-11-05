import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.10";
import { calculateAllocation } from "./allocation-algorithm.js";

const allowedOrigin="https://rogerlehmann86-tech.github.io";
function headers(origin) {
  return {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    ...(origin===allowedOrigin?{"Access-Control-Allow-Origin":allowedOrigin}:{}),
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
}
function respond(body,status=200,origin=""){return new Response(JSON.stringify(body),{status,headers:headers(origin)});}
async function readAll(db,table,cols,campaignId,orderKey="id",limit=3500) {
  const items=[];
  for(let start=0;start<limit;start+=500){
    const {data,error}=await db.from(table).select(cols).eq("campaign_id",campaignId)
      .order(orderKey,{ascending:true}).range(start,start+499);
    if(error)throw new Error(table+": "+error.message);
    items.push(...(data||[]));
    if((data||[]).length<500)return items;
  }
  throw new Error("Die Ausschreibung enthält zu viele Datensätze für diese Testversion.");
}
Deno.serve(async(req)=>{
  const origin=req.headers.get("Origin")||"";
  if(origin&&origin!==allowedOrigin)return respond({error:"Herkunft nicht freigegeben."},403,origin);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=="POST")return respond({error:"Methode nicht erlaubt."},405,origin);
  const auth=req.headers.get("Authorization")||"";
  const token=auth.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return respond({error:"Anmeldung erforderlich."},401,origin);
  try{
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
    if(!url||!key)throw Error("Konfiguration auf dem Server fehlt.");
    const db=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await db.auth.getUser(token);
    if(authError||!user)return respond({error:"Sitzung ist nicht mehr gültig."},401,origin);
    const {data:admin,error:adminError}=await db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
    if(adminError||!admin)return respond({error:"Keine Administratorberechtigung."},403,origin);
    const payload=await req.json();
    const campaignId=String(payload?.campaign_id||"");
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(campaignId))return respond({error:"Ausschreibungs-ID ungültig."},400,origin);
    const {data:campaign,error:campaignError}=await db.from("campaigns")
      .select("id,title,status,ends_at,modules_per_student,max_preferences").eq("id",campaignId).single();
    if(campaignError||!campaign)return respond({error:"Ausschreibung nicht gefunden."},404,origin);
    if(!(["closed","allocated"].includes(campaign.status)||
      (campaign.status==="open"&&new Date(campaign.ends_at)<=new Date())))
      return respond({error:"Die Anmeldung muss zuerst geschlossen sein."},409,origin);

    const [modules,slots,registrations,preferences,locked]=await Promise.all([
      readAll(db,"modules","id,campaign_id,title,min_capacity,max_capacity,time_slot_id,active",campaignId),
      readAll(db,"time_slots","id,campaign_id,title,starts_at,ends_at",campaignId),
      readAll(db,"registrations","id,campaign_id,student_id",campaignId),
      readAll(db,"preferences","id,registration_id,campaign_id,module_id,rank",campaignId),
      (async()=>{const {data,error}=await db.from("assignments")
        .select("student_id,module_id,source,locked").eq("campaign_id",campaignId).eq("locked",true);
        if(error)throw Error(error.message);return data||[];})()
    ]);
    const ids=[...new Set(registrations.map(r=>r.student_id))];
    const active=new Set();
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await db.from("students").select("id").eq("active",true).in("id",ids.slice(i,i+100));
      if(error)throw Error(error.message);
      for(const s of data||[])active.add(s.id);
    }
    const validRegistrations=registrations.filter(r=>active.has(r.student_id));
    const seed=typeof payload?.seed==="string"&&payload.seed.length>=8&&payload.seed.length<=100
      ? payload.seed: Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,"0")).join("");
    const result=calculateAllocation({campaign,modules,slots,registrations:validRegistrations,preferences,locked,seed});
    return respond(result,200,origin);
  }catch(err){
    return respond({error:err instanceof Error?err.message:"Berechnung fehlgeschlagen."},400,origin);
  }
});
