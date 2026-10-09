import { NextResponse } from "next/server";
import { actor, sameOrigin, limit, HttpError, approvedInstruction } from "@/lib/security";
import * as service from "@/lib/services";
import {authorizeUpload,finishUpload} from "@/lib/blob-documents";
import {db} from "@/lib/db";
import {start} from "workflow/api";
import {documentJobWorkflow,reminderWorkflow} from "@/workflows/care-jobs";
export const runtime="nodejs";
export const maxDuration=300;
export const dynamic="force-dynamic";
async function bytes(req:Request,max:number) {
  const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw new HttpError(413,"TOO_LARGE","Request is too large.");}chunks.push(part.value);}}finally{reader.releaseLock();}
  const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}return joined;
}
async function handler(req:Request, ctx:{params:Promise<{path:string[]}>}) {
  try {
    const {path:p}=await ctx.params; const u=await actor(req.headers); const m=req.method;
    if(m!=="GET") {sameOrigin(req);await limit(u,p[0]);}
    const body=async()=>{const data=await bytes(req,120000);try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new HttpError(422,"INVALID_JSON","Provide a valid JSON request.");}};
    let data:unknown;
    if(m==="GET" && p[0]==="workspace") data=await service.workspace(u,new URL(req.url).searchParams.get("patientId") || undefined);
    else if(m==="POST" && p[0]==="patients" && p[1]==="assign" && !p[2]) data=await service.assignPatient(u,await body());
    else if(m==="GET" && p[0]==="instructions" && p[1]) data=await approvedInstruction(u,p[1]);
    else if(m==="GET" && p[0]==="teachback" && p[1]==="history") data=await service.history(u,new URL(req.url).searchParams);
    else if(m==="GET" && p[0]==="jobs" && p[1]) data=await service.jobStatus(u,p[1]);
    else if(m==="GET" && p[0]==="documents" && p[1]) {const f=await service.download(u,p[1]);let offset=0;const stream=new ReadableStream({pull(controller){if(offset>=f.bytes.length){controller.close();return;}const end=Math.min(offset+256*1024,f.bytes.length);controller.enqueue(f.bytes.slice(offset,end));offset=end;}});return new Response(stream,{headers:{"Content-Type":f.mimeType,"Content-Disposition":`attachment; filename="${f.name}"`,"Cache-Control":"private, no-store"}});}
    else if(m==="POST" && p[0]==="documents" && p[1]==="upload-authorization" && !p[2]) data=await authorizeUpload(u,await body());
    else if(m==="POST" && p[0]==="documents" && p[1]==="blob" && !p[2]) data=await finishUpload(u,await body());
    else if(m==="POST" && p[0]==="documents" && !p[1]) {const dataBytes=await bytes(req,11*1024*1024);const formRequest=new Request(req.url,{method:"POST",headers:{"Content-Type":req.headers.get("content-type") || ""},body:Buffer.from(dataBytes)});let form:FormData;try{form=await formRequest.formData();}catch{throw new HttpError(422,"INVALID_FORM","Provide a document upload form.");}data=await service.upload(u,form);}
    else if(m==="POST" && p[0]==="plans" && p[1] && p[2]==="versions") data=await service.createDraft(u,p[1]);
    else if(m==="PATCH" && p[0]==="instructions" && p[1]) data=await service.updateInstruction(u,p[1],await body());
    else if(m==="POST" && p[0]==="versions" && p[1] && p[2]==="generate") data=await service.generateExplanations(u,p[1]);
    else if(m==="POST" && p[0]==="versions" && p[1] && p[2]==="extract" && !p[3]) data=await service.recoverExtraction(u,p[1]);
    else if(m==="POST" && p[0]==="versions" && p[1] && p[2]==="extract-new" && !p[3]) data=await service.extractNewDraft(u,p[1]);
    else if(m==="POST" && p[0]==="versions" && p[1] && p[2]==="approve") data=await service.approve(u,p[1]);
    else if(m==="PATCH" && p[0]==="explanations" && p[1]) data=await service.reviewExplanation(u,p[1],await body());
    else if(m==="POST" && p[0]==="teachback") data=await service.submitTeachBack(u,await body());
    else if(m==="POST" && p[0]==="invitations" && p[1]==="accept") data=await service.acceptInvitation(u,await body());
    else if(m==="POST" && p[0]==="invitations" && !p[1]) data=await service.invite(u,await body());
    else if(m==="POST" && p[0]==="invitations" && p[2]==="revoke") data=await service.revoke(u,p[1],"invitation");
    else if(m==="POST" && p[0]==="grants" && p[2]==="revoke") data=await service.revoke(u,p[1],"grant");
    else if(m==="POST" && p[0]==="clarifications" && !p[1]) data=await service.ask(u,await body());
    else if(m==="PATCH" && p[0]==="clarifications" && p[1]) data=await service.respond(u,p[1],await body());
    else if(m==="POST" && p[0]==="reminders" && !p[1]) data=await service.createReminder(u,await body());
    else if(m==="PATCH" && p[0]==="reminders" && p[1]) data=await service.changeReminder(u,p[1],await body());
    else if(m==="PATCH" && p[0]==="settings") data=await service.settings(u,await body());
    else if(m==="PATCH" && p[0]==="notifications" && p[1]) data=await service.markRead(u,p[1]);
    else throw new HttpError(404,"ENDPOINT_NOT_FOUND","Endpoint not found.");
    if(process.env.VERCEL==="1" && m==="POST" && data && typeof data==="object" && "id" in data && typeof data.id==="string"){
      if(p[0]==="reminders" && !p[1])await start(reminderWorkflow,[data.id]);
      if(p[0]==="documents" && p[1]!=="upload-authorization"){const job=await db.processingJob.findFirst({where:{documentId:data.id},select:{id:true}});if(job)await start(documentJobWorkflow,[job.id]);}
    }
    return NextResponse.json({data},{headers:{"Cache-Control":"private, no-store"}});
  } catch(e) {const r=service.safeError(e);return NextResponse.json({error:r.error},{status:r.status,headers:{"Cache-Control":"no-store"}});}
}
export {handler as GET,handler as POST,handler as PATCH};
