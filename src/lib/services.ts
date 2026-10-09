import { db, mode } from "./db";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { HttpError, permit, requireClinician, approvedInstruction, hashToken, type Actor } from "./security";
import { instructionSchema, clinicalFields, sourceGrounded, permissionSchema, teachBackSchema } from "./contracts";
import { compare, draftExplanation, ProviderFailure } from "./ai";
import { overallStatus } from "./teachback";
import { storePrivate, readPrivate, validateFile } from "./storage";
import {languageCodes,type Language} from "./languages";
import {authOrigin} from "./auth-origin";
import {extractSourceFields,sourceExtractionMethod,isUntouchedLegacyExtraction} from "./source-extraction";
export {assignPatient} from "./expert-patients";
const audit = (actorId:string,action:string,resourceId:string) => ({actorId,action,resourceId});
const profileSelect={id:true,user:{select:{id:true,name:true,email:true,username:true}},language:true,timezone:true,largeText:true};
export async function workspace(user: Actor, patientId?: string) {
  const patients = await db.patientProfile.findMany({where:user.role==="CLINICIAN" ? {assignments:{some:{clinicianId:user.id}},user:{dataMode:mode}}
    : user.role==="FAMILY" ? {grants:{some:{familyId:user.id,revokedAt:null,permissions:{has:"READ"}}},user:{dataMode:mode}} : {userId:user.id},select:profileSelect,orderBy:{user:{createdAt:"asc"}},take:50});
  const selected=patientId || patients[0]?.id;
  if(selected) await permit(user,selected);
  let familyPermissions:string[]=[];
  if(user.role==="FAMILY" && selected) familyPermissions=(await db.familyAccessGrant.findUnique({where:{patientId_familyId:{patientId:selected,familyId:user.id}}}))?.permissions || [];
  const clinician=user.role==="CLINICIAN";
  const plans=selected ? await db.carePlan.findMany({where:{patientId:selected,dataMode:mode},include:{versions:{where:clinician?{}:{status:"APPROVED",publishedFor:{isNot:null}},orderBy:{number:"desc"},include:{instructions:{orderBy:{id:"asc"},include:{explanations:{where:clinician?{}:{status:"APPROVED"}}}},document:clinician?true:false}},approvedVersion:false},take:50}) : [];
  const currentIds=plans.flatMap(p=>p.versions.filter(v=>v.id===p.approvedVersionId).flatMap(v=>v.instructions.map(i=>i.id)));
  const [documents,attempts,requests,reminders,notifications,grants,invitations] = await Promise.all([
    clinician && selected ? db.document.findMany({where:{patientId:selected},include:{jobs:{select:{id:true,status:true,attempts:true,errorCode:true}}},orderBy:{createdAt:"desc"},take:50}) : [],
    selected && (user.role!=="FAMILY" || familyPermissions.includes("TEACH_BACK")) ? db.teachBackAttempt.findMany({where:{version:{status:"APPROVED",plan:{patientId:selected}},...(!clinician && user.role==="FAMILY"?{answeredById:user.id}:{})},include:{findings:true,answeredBy:{select:{name:true}}},orderBy:{createdAt:"desc"},take:50}) : [],
    selected && (user.role!=="FAMILY" || familyPermissions.includes("CLARIFY")) ? db.clarificationRequest.findMany({where:{instruction:{version:{plan:{patientId:selected}}}},include:{instruction:{select:{title:true}},requestedBy:{select:{name:true}}},orderBy:{createdAt:"desc"},take:50}) : [],
    selected && (user.role!=="FAMILY" || familyPermissions.includes("REMINDERS")) ? db.reminder.findMany({where:{instructionId:{in:currentIds}},orderBy:{scheduledAt:"asc"},take:50}) : [],
    db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:50}),
    user.role==="PATIENT" && selected ? db.familyAccessGrant.findMany({where:{patientId:selected},include:{family:{select:{name:true,email:true}}}}) : [],
    user.role==="PATIENT" && selected ? db.familyInvitation.findMany({where:{patientId:selected},select:{id:true,email:true,permissions:true,expiresAt:true,acceptedAt:true,revokedAt:true},orderBy:{createdAt:"desc"},take:50}) : []
  ]);
  return {user:{id:user.id,name:user.name,email:user.email,username:user.username,role:user.role},mode,storageDriver:process.env.STORAGE_DRIVER||"local",providerMode:process.env.AI_PROVIDER,patients,selectedPatientId:selected || null,plans,documents,attempts,requests,reminders,notifications,grants,invitations,familyPermissions};
}
async function draftVersion(user:Actor,id:string) {
  requireClinician(user);
  const v=await db.carePlanVersion.findUnique({where:{id},include:{plan:true,document:true,instructions:{include:{explanations:true}}}});
  if(!v) throw new HttpError(404,"NOT_FOUND","Plan version not found.");
  await permit(user,v.plan.patientId);
  if(v.status!=="DRAFT") throw new HttpError(409,"IMMUTABLE_VERSION","Create a new draft to change an approved plan.");
  return v;
}
export async function createDraft(user:Actor,planId:string) {
  requireClinician(user);
  const p=await db.carePlan.findUnique({where:{id:planId},include:{versions:{orderBy:{number:"desc"},take:1,include:{instructions:{include:{explanations:true}}}}}});
  if(!p) throw new HttpError(404,"NOT_FOUND","Plan not found."); await permit(user,p.patientId);
  return db.$transaction(async tx=> {
    await tx.$queryRaw`SELECT id FROM "CarePlan" WHERE id=${planId} FOR UPDATE`;
    if(await tx.carePlanVersion.findFirst({where:{planId,status:"DRAFT"}})) throw new HttpError(409,"DRAFT_EXISTS","Review the existing draft first.");
    const source=await tx.carePlanVersion.findFirst({where:{planId},orderBy:{number:"desc"},include:{instructions:{include:{explanations:true}}}});
    if(!source) throw new HttpError(409,"NO_VERSION","No source version available.");
    const v=await tx.carePlanVersion.create({data:{planId,number:source.number+1,method:source.method,documentId:source.documentId}});
    for(const i of source.instructions) {
      const {id:oldId,versionId,explanations,reviewState,...values}=i; void oldId; void versionId; void reviewState;
      await tx.careInstruction.create({data:{...values,versionId:v.id,explanations:{create:explanations.map(e=>({language:e.language,text:e.text,status:"DRAFT",sourceFields:e.sourceFields,method:e.method}))}}});
    }
    await tx.auditEvent.create({data:audit(user.id,"PLAN_DRAFT_CREATED",v.id)}); return {id:v.id};
  });
}
export async function updateInstruction(user:Actor,id:string,body:unknown) {
  const input=z.object({instruction:instructionSchema,reviewed:z.boolean()}).strict().parse(body);
  const i=await db.careInstruction.findUnique({where:{id}}); if(!i) throw new HttpError(404,"NOT_FOUND","Instruction not found.");
  const v=await draftVersion(user,i.versionId);
  sourceGrounded(input.instruction,v.document?.sourceText || i.sourcePassage);
  return db.$transaction(async tx=> {
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${v.id} FOR UPDATE`;
    if((await tx.carePlanVersion.findUnique({where:{id:v.id}}))?.status!=="DRAFT") throw new HttpError(409,"IMMUTABLE_VERSION","Plan already approved.");
    const data={...input.instruction,followUpAt:input.instruction.followUpAt?new Date(input.instruction.followUpAt):null,reviewState:input.reviewed?"REVIEWED":"DRAFT"};
    const row=await tx.careInstruction.update({where:{id},data});
    // Any edit requires explanation review again, even when the old translations are retained.
    await tx.instructionExplanation.updateMany({where:{instructionId:id},data:{status:"DRAFT"}});
    await tx.auditEvent.create({data:audit(user.id,"EXTRACTION_REVIEWED",id)}); return row;
  });
}
/** Upgrade only untouched, unpublished legacy extraction; never replace a doctor's edits. */
export async function recoverExtraction(user:Actor,id:string){
  const v=await draftVersion(user,id);
  if(!isUntouchedLegacyExtraction(v))return {recovered:false};
  if(!v.document?.sourceText)throw new HttpError(409,"NO_SOURCE_TEXT","Source text is unavailable. Upload or paste the original document again.");
  const instructions=extractSourceFields(v.document.sourceText);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${id} FOR UPDATE`;
    const current=await tx.carePlanVersion.findUniqueOrThrow({where:{id},include:{instructions:{include:{explanations:true}}}});
    if(!isUntouchedLegacyExtraction(current))return {recovered:false};
    if(await tx.auditEvent.count({where:{action:"EXTRACTION_REVIEWED",resourceId:{in:current.instructions.map(i=>i.id)}}}))return {recovered:false};
    await tx.careInstruction.deleteMany({where:{versionId:id}});
    for(const i of instructions)await tx.careInstruction.create({data:{...i,followUpAt:i.followUpAt?new Date(i.followUpAt):null,versionId:id}});
    await tx.carePlanVersion.update({where:{id},data:{method:sourceExtractionMethod}});
    await tx.auditEvent.create({data:audit(user.id,"SOURCE_EXTRACTION_RECOVERED",id)});
    return {recovered:true,instructions:instructions.length};
  });
}
export async function extractNewDraft(user:Actor,id:string){
  const v=await draftVersion(user,id);
  if(!v.document?.sourceText)throw new HttpError(409,"NO_SOURCE_TEXT","Source text is unavailable. Upload or paste the original document again.");
  const instructions=extractSourceFields(v.document.sourceText);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "CarePlan" WHERE id=${v.planId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${id} FOR UPDATE`;
    if((await tx.carePlanVersion.findUniqueOrThrow({where:{id}})).status!=="DRAFT")throw new HttpError(409,"IMMUTABLE_VERSION","This draft has already changed. Refresh the plan review.");
    const latest=await tx.carePlanVersion.findFirstOrThrow({where:{planId:v.planId},orderBy:{number:"desc"}});
    // Preserve every previous edit in its original version, including translations.
    await tx.carePlanVersion.update({where:{id},data:{status:"SUPERSEDED"}});
    const next=await tx.carePlanVersion.create({data:{planId:v.planId,documentId:v.documentId,number:latest.number+1,method:sourceExtractionMethod}});
    for(const i of instructions)await tx.careInstruction.create({data:{...i,followUpAt:i.followUpAt?new Date(i.followUpAt):null,versionId:next.id}});
    await tx.auditEvent.create({data:audit(user.id,"SOURCE_REEXTRACTED_TO_NEW_DRAFT",next.id)});
    return {id:next.id};
  });
}
export async function generateExplanations(user:Actor,id:string) {
  const v=await draftVersion(user,id);
  if(!v.instructions.length||v.instructions.some(i=>i.reviewState!=="REVIEWED" || i.sourceUnclear)) throw new HttpError(409,"REVIEW_REQUIRED","Review the extracted fields and resolve unclear sources first.");
  const drafts: {instructionId:string;language:Language;text:string;method:string;sourceFields:string[]}[]=[];
  for(const i of v.instructions) for(const language of languageCodes) {
    if(i.explanations.some(e=>e.language===language && (e.text.trim() || e.status!=="DRAFT")))continue;
    const normalized=instructionSchema.parse({...Object.fromEntries(Object.keys(instructionSchema.shape).map(k=>[k,k==="followUpAt"?i.followUpAt?.toISOString() || null:i[k as keyof typeof i]]))});
    drafts.push({instructionId:i.id,language,...await draftExplanation(normalized,language)});
  }
  return db.$transaction(async tx=> {
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${id} FOR UPDATE`;
    if((await tx.carePlanVersion.findUnique({where:{id}}))?.status!=="DRAFT") throw new HttpError(409,"IMMUTABLE_VERSION","Plan already approved.");
    let generated=0;
    for(const d of drafts){
      const existing=await tx.instructionExplanation.findUnique({where:{instructionId_language:{instructionId:d.instructionId,language:d.language}}});
      // Generation is separate from review: retain saved translations and their
      // review state instead of erasing them when the button is clicked again.
      if(existing){
        if(existing.status!=="DRAFT" || existing.text.trim() || !d.text.trim())continue;
        await tx.instructionExplanation.update({where:{id:existing.id},data:{text:d.text,method:d.method,sourceFields:d.sourceFields}});
      }else await tx.instructionExplanation.create({data:{...d,status:"DRAFT"}});
      generated++;
    }
    await tx.auditEvent.create({data:audit(user.id,"EXPLANATIONS_DRAFTED",id)}); return {generated};
  });
}
export async function reviewExplanation(user:Actor,id:string,body:unknown) {
  const input=z.object({text:z.string().trim().min(1).max(8000),reviewed:z.boolean()}).strict().parse(body);
  const e=await db.instructionExplanation.findUnique({where:{id},include:{instruction:true}}); if(!e) throw new HttpError(404,"NOT_FOUND","Explanation not found.");
  const v=await draftVersion(user,e.instruction.versionId);
  if(e.language==="en") for(const f of clinicalFields) if(e.instruction[f] && !input.text.toLowerCase().includes(e.instruction[f]!.toLowerCase())) throw new HttpError(422,"CLINICAL_VALUE_CHANGED",`Preserve the approved ${f} in the English explanation.`);
  return db.$transaction(async tx=> {
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${v.id} FOR UPDATE`;
    if((await tx.carePlanVersion.findUnique({where:{id:v.id}}))?.status!=="DRAFT") throw new HttpError(409,"IMMUTABLE_VERSION","Plan already approved.");
    const row=await tx.instructionExplanation.update({where:{id},data:{text:input.text,status:input.reviewed?"REVIEWED":"DRAFT"}});
    await tx.auditEvent.create({data:audit(user.id,"EXPLANATION_REVIEWED",id)}); return row;
  });
}
export async function approve(user:Actor,id:string,body:unknown={}) {
  const options=z.object({publishSourceOnly:z.boolean().optional()}).strict().parse(body);
  const v=await draftVersion(user,id);
  return db.$transaction(async tx=> {
    await tx.$queryRaw`SELECT id FROM "CarePlan" WHERE id=${v.planId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "CarePlanVersion" WHERE id=${id} FOR UPDATE`;
    const current=await tx.carePlanVersion.findUniqueOrThrow({where:{id},include:{instructions:{include:{explanations:true}}}});
    if(current.status!=="DRAFT") throw new HttpError(409,"IMMUTABLE_VERSION","This version has already been approved.");
    if(!current.instructions.length || current.instructions.some(i=>i.sourceUnclear || i.reviewState!=="REVIEWED"))throw new HttpError(409,"APPROVAL_BLOCKED","Review every extracted instruction and resolve unclear sources before approval.");
    if(!options.publishSourceOnly && current.instructions.some(i=>!i.explanations.some(e=>e.language==="en"&&e.status==="REVIEWED")))throw new HttpError(409,"APPROVAL_BLOCKED","Review the English explanations, or explicitly confirm publication of the reviewed original instructions.");
    // The patient view already falls back to the approved source quotation.
    // Source-only publication leaves every unreviewed explanation intact/private.
    const row=await tx.carePlanVersion.update({where:{id},data:{status:"APPROVED",approvedAt:new Date()}});
    await tx.careInstruction.updateMany({where:{versionId:id},data:{reviewState:"APPROVED"}});
    // Optional translations stay private until reviewed; publishing never approves an empty draft.
    await tx.instructionExplanation.updateMany({where:{instruction:{versionId:id},status:"REVIEWED"},data:{status:"APPROVED"}});
    await tx.carePlan.update({where:{id:v.planId},data:{approvedVersionId:id}});
    await tx.approvalRecord.create({data:{versionId:id,clinicianId:user.id}});
    await tx.notification.create({data:{userId:(await tx.patientProfile.findUniqueOrThrow({where:{id:v.plan.patientId}})).userId,dedupeKey:`approved:${id}`,title:"Your care plan is ready",body:"Your care team approved a new version. Open your care plan to read it."}});
    await tx.auditEvent.create({data:audit(user.id,"PLAN_APPROVED",id)}); return row;
  });
}
export async function upload(user:Actor, form:FormData) {
  requireClinician(user); const patientId=z.string().min(1).parse(form.get("patientId")); await permit(user,patientId);
  const text=form.get("text"); const file=form.get("file");
  let storageKey:string|undefined, sourceText:string|undefined, mimeType="text/plain",name="Manual discharge text";
  if(typeof text==="string" && text.trim()) sourceText=z.string().trim().min(5).max(100000).parse(text);
  else if(file instanceof File) { const bytes=new Uint8Array(await file.arrayBuffer()); mimeType=file.type; try{validateFile(bytes,mimeType);}catch{throw new HttpError(422,"INVALID_FILE","Choose a valid PDF, PNG, or JPEG file, up to 10 MB.");}storageKey=await storePrivate(bytes,mimeType); name=file.name.replace(/[^a-zA-Z0-9 ._-]/g,"_").slice(0,200); }
  else throw new HttpError(422,"DOCUMENT_REQUIRED","Choose a PDF/image or paste discharge text.");
  return db.$transaction(async tx=> {
    const d=await tx.document.create({data:{patientId,uploadedById:user.id,name,mimeType,sourceText,storageKey,jobs:{create:{kind:"DOCUMENT",idempotencyKey:`document:${randomBytes(20).toString("hex")}`}}}});
    await tx.auditEvent.create({data:audit(user.id,"DOCUMENT_UPLOADED",d.id)}); return {id:d.id,status:d.status};
  });
}
export async function download(user:Actor,id:string) {
  requireClinician(user); const d=await db.document.findUnique({where:{id}}); if(!d) throw new HttpError(404,"NOT_FOUND","Document not found."); await permit(user,d.patientId);
  await db.auditEvent.create({data:audit(user.id,"DOCUMENT_DOWNLOADED",id)});
  return {bytes:d.storageKey?await readPrivate(d.storageKey):new TextEncoder().encode(d.sourceText || ""),mimeType:d.mimeType,name:d.name};
}
export async function submitTeachBack(user:Actor,body:unknown) {
  const input=teachBackSchema.parse(body); const i=await approvedInstruction(user,input.instructionId,"TEACH_BACK");
  if(user.role==="CLINICIAN" || (user.role==="FAMILY" && input.personType!=="CAREGIVER") || (user.role==="PATIENT" && input.personType==="CAREGIVER")) throw new HttpError(403,"INVALID_PERSON_TYPE","Record the answering person accurately.");
  const result=await compare(i,input.transcript);
  return db.$transaction(async tx=> {
    // Recheck current publication before saving a result from a potentially slow provider call.
    if((await tx.carePlan.findUnique({where:{id:i.version.plan.id}}))?.approvedVersionId!==i.versionId) throw new HttpError(409,"PLAN_CHANGED","Your care plan changed. Open the latest instruction and try again.");
    if(user.role==="FAMILY") {
      const g=await tx.familyAccessGrant.findUnique({where:{patientId_familyId:{patientId:i.version.plan.patientId,familyId:user.id}}});
      if(!g || g.revokedAt || !g.permissions.includes("TEACH_BACK")) throw new HttpError(403,"FORBIDDEN","Family access has been revoked.");
    }
    const attempt=await tx.teachBackAttempt.create({data:{...input,versionId:i.versionId,answeredById:user.id,method:result.method,status:overallStatus(result.findings),findings:{create:result.findings}},include:{findings:true}});
    if(result.method==="care-team review") {
      const request=await tx.clarificationRequest.create({data:{instructionId:i.id,requestedById:user.id,question:`Please review my teach-back: ${input.transcript}`}});
      const assignments=await tx.clinicianPatientAssignment.findMany({where:{patientId:i.version.plan.patientId}});
      for(const a of assignments)await tx.notification.create({data:{userId:a.clinicianId,dedupeKey:`teachback-review:${attempt.id}:${a.clinicianId}`,title:"Teach-back awaiting review",body:"A patient or caregiver submitted an answer. Open the clarification queue to review it."}});
      await tx.auditEvent.create({data:audit(user.id,"TEACH_BACK_REVIEW_REQUESTED",request.id)});
    }
    await tx.auditEvent.create({data:audit(user.id,"TEACH_BACK_SUBMITTED",attempt.id)}); return attempt;
  });
}
export async function invite(user:Actor,body:unknown) {
  const input=z.object({patientId:z.string(),email:z.email(),permissions:permissionSchema}).strict().parse(body);
  const p=await db.patientProfile.findUnique({where:{id:input.patientId}});
  if(user.role!=="PATIENT" || p?.userId!==user.id) throw new HttpError(403,"FORBIDDEN","Only the patient can invite family.");
  const token=randomBytes(32).toString("base64url");
  const row=await db.$transaction(async tx=> {const i=await tx.familyInvitation.create({data:{...input,email:input.email.toLowerCase(),tokenHash:hashToken(token),expiresAt:new Date(Date.now()+48*60*60*1000)}}); await tx.auditEvent.create({data:audit(user.id,"FAMILY_INVITED",i.id)});return i;});
  return {id:row.id,expiresAt:row.expiresAt,link:`${authOrigin}/invite?token=${token}`};
}
export async function acceptInvitation(user:Actor,body:unknown) {
  const {token}=z.object({token:z.string().min(30).max(100)}).strict().parse(body);
  if(user.role==="CLINICIAN") throw new HttpError(403,"FORBIDDEN","Use a family account to accept this invitation.");
  return db.$transaction(async tx=> {
    const i=await tx.familyInvitation.findUnique({where:{tokenHash:hashToken(token)},include:{patient:{include:{user:{select:{dataMode:true}}}}}});
    if(!i || i.acceptedAt || i.revokedAt || i.expiresAt<new Date() || i.email!==user.email.toLowerCase() || i.patient.userId===user.id || i.patient.user.dataMode!==user.dataMode) throw new HttpError(410,"INVITATION_UNAVAILABLE","This invitation is unavailable, expired, used, or belongs to another email.");
    const consumed=await tx.familyInvitation.updateMany({where:{id:i.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});
    if(consumed.count!==1) throw new HttpError(410,"INVITATION_UNAVAILABLE","This invitation has already been used.");
    await tx.user.update({where:{id:user.id},data:{role:"FAMILY"}});
    const g=await tx.familyAccessGrant.upsert({where:{patientId_familyId:{patientId:i.patientId,familyId:user.id}},create:{patientId:i.patientId,familyId:user.id,permissions:i.permissions},update:{permissions:i.permissions,revokedAt:null}});
    await tx.auditEvent.create({data:audit(user.id,"FAMILY_INVITATION_ACCEPTED",g.id)});return {id:g.id};
  });
}
export async function revoke(user:Actor,id:string,type:"grant"|"invitation") {
  const row=type==="grant"?await db.familyAccessGrant.findUnique({where:{id}}):await db.familyInvitation.findUnique({where:{id}});
  if(!row) throw new HttpError(404,"NOT_FOUND","Access record not found.");
  const p=await db.patientProfile.findUnique({where:{id:row.patientId}});
  if(user.role!=="PATIENT" || p?.userId!==user.id) throw new HttpError(403,"FORBIDDEN","Only the patient can revoke access.");
  return db.$transaction(async tx=> {
    const result=type==="grant"?await tx.familyAccessGrant.update({where:{id},data:{revokedAt:new Date()}}):await tx.familyInvitation.update({where:{id},data:{revokedAt:new Date()}});
    await tx.auditEvent.create({data:audit(user.id,"FAMILY_ACCESS_REVOKED",id)});return {id:result.id};
  });
}
export async function ask(user:Actor,body:unknown) {
  const input=z.object({instructionId:z.string(),question:z.string().trim().min(5).max(2000)}).strict().parse(body);
  await approvedInstruction(user,input.instructionId,"CLARIFY");
  if(user.role==="CLINICIAN") throw new HttpError(403,"FORBIDDEN","Use the clinician clarification queue.");
  return db.$transaction(async tx=> {const r=await tx.clarificationRequest.create({data:{...input,requestedById:user.id}}); await tx.auditEvent.create({data:audit(user.id,"CLARIFICATION_REQUESTED",r.id)}); return r;});
}
export async function respond(user:Actor,id:string,body:unknown) {
  requireClinician(user); const {response}=z.object({response:z.string().trim().min(5).max(3000)}).strict().parse(body);
  const r=await db.clarificationRequest.findUnique({where:{id},include:{instruction:{include:{version:{include:{plan:true}}}}}});
  if(!r) throw new HttpError(404,"NOT_FOUND","Question not found."); await permit(user,r.instruction.version.plan.patientId);
  return db.$transaction(async tx=> {const row=await tx.clarificationRequest.update({where:{id},data:{response,status:"RESOLVED",respondedById:user.id,resolvedAt:new Date()}});
    await tx.notification.upsert({where:{dedupeKey:`clarification:${id}`},create:{userId:r.requestedById,dedupeKey:`clarification:${id}`,title:"Your care team replied",body:"Open clarification requests to read the response."},update:{}});
    await tx.auditEvent.create({data:audit(user.id,"CLARIFICATION_RESOLVED",id)});return row;
  });
}
export async function createReminder(user:Actor,body:unknown) {
  const input=z.object({instructionId:z.string(),scheduledAt:z.iso.datetime(),timezone:z.string().max(100)}).strict().parse(body);
  await approvedInstruction(user,input.instructionId,"REMINDERS");
  try{new Intl.DateTimeFormat("en",{timeZone:input.timezone});}catch{throw new HttpError(422,"INVALID_TIMEZONE","Choose a valid timezone.");}
  const date=new Date(input.scheduledAt); if(date<new Date(Date.now()-5000) || date>new Date(Date.now()+365*86400000)) throw new HttpError(422,"INVALID_REMINDER_TIME","Choose a future time within one year.");
  return db.$transaction(async tx=>{const r=await tx.reminder.create({data:{...input,scheduledAt:date,createdById:user.id}});await tx.auditEvent.create({data:audit(user.id,"REMINDER_SCHEDULED",r.id)});return r;});
}
export async function changeReminder(user:Actor,id:string,body:unknown) {
  const {action}=z.object({action:z.enum(["COMPLETE","CANCEL"])}).strict().parse(body);
  const r=await db.reminder.findUnique({where:{id}});if(!r) throw new HttpError(404,"NOT_FOUND","Reminder not found."); await approvedInstruction(user,r.instructionId,"REMINDERS");
  return db.$transaction(async tx=>{const row=await tx.reminder.update({where:{id},data:action==="COMPLETE"?{reportedCompletedAt:new Date(),reportedById:user.id}:{status:"CANCELLED"}});await tx.auditEvent.create({data:audit(user.id,action==="COMPLETE"?"COMPLETION_REPORTED":"REMINDER_CANCELLED",id)});return row;});
}
export async function settings(user:Actor,body:unknown) {
  const input=z.object({language:z.enum(languageCodes),timezone:z.string().max(100),largeText:z.boolean()}).strict().parse(body);
  try{new Intl.DateTimeFormat("en",{timeZone:input.timezone});}catch{throw new HttpError(422,"INVALID_TIMEZONE","Choose a valid timezone.");}
  if(user.role!=="PATIENT") throw new HttpError(403,"FORBIDDEN","Patient settings required.");
  return db.patientProfile.update({where:{userId:user.id},data:input});
}
export async function markRead(user:Actor,id:string) {
  const n=await db.notification.updateMany({where:{id,userId:user.id},data:{readAt:new Date()}});
  if(!n.count) throw new HttpError(404,"NOT_FOUND","Notification not found."); return {id};
}
export async function jobStatus(user:Actor,id:string) {
  requireClinician(user); const j=await db.processingJob.findUnique({where:{id},include:{document:{select:{patientId:true}}}});
  if(!j?.document) throw new HttpError(404,"NOT_FOUND","Processing job not found.");await permit(user,j.document.patientId);
  return {id:j.id,status:j.status,attempts:j.attempts,errorCode:j.errorCode};
}
export async function history(user:Actor,query:URLSearchParams) {
  const input=z.object({patientId:z.string().min(1),cursor:z.string().max(100).optional(),limit:z.coerce.number().int().min(1).max(50).default(20)}).parse(Object.fromEntries(query));
  await permit(user,input.patientId,"TEACH_BACK");
  const where:Prisma.TeachBackAttemptWhereInput={version:{status:"APPROVED",plan:{patientId:input.patientId}},...(user.role==="FAMILY"?{answeredById:user.id}:{})};
  if(input.cursor && !(await db.teachBackAttempt.findFirst({where:{...where,id:input.cursor},select:{id:true}})))throw new HttpError(404,"NOT_FOUND","History cursor not found.");
  const rows=await db.teachBackAttempt.findMany({where,include:{findings:true,answeredBy:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:input.limit+1,...(input.cursor?{cursor:{id:input.cursor},skip:1}:{})});
  return {items:rows.slice(0,input.limit),nextCursor:rows.length>input.limit?rows[input.limit-1].id:null};
}
export function safeError(e:unknown) {
  if(e instanceof HttpError) return {status:e.status,error:{code:e.code,message:e.message}};
  if(e instanceof z.ZodError) return {status:422,error:{code:"VALIDATION_ERROR",message:"Check the required fields and confirm voice transcripts before submitting."}};
  if(e instanceof Error&&e.message==="SOURCE_REQUIRES_SMALLER_SECTIONS")return {status:422,error:{code:e.message,message:"Split this source into smaller documents before extracting its instructions."}};
  if(e instanceof ProviderFailure) return {status:503,error:{code:e.code,message:e.code==="DEMO_COMPARISON_UNSUPPORTED"?"Demo comparison supports the fictional medication fixtures only. This instruction requires care-team review or a configured live provider.":"The comparison or generation could not be completed. Your approved instructions are unchanged. Please retry or ask your care team."}};
  if(e instanceof Error && ["UNVERIFIABLE_SOURCE","UNSUPPORTED_CLINICAL_VALUE","UNVERIFIABLE_FOLLOW_UP_DATE"].includes(e.message))return {status:422,error:{code:e.message,message:"The corrected values must be supported by the original source passage. Leave missing details empty and request doctor clarification."}};
  if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") return {status:409,error:{code:"CONFLICT",message:"This record already exists."}};
  return {status:500,error:{code:"REQUEST_FAILED",message:"The request could not be completed. Please try again."}};
}
