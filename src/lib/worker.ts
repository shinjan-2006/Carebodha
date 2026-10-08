import { db, mode } from "./db";
import { randomUUID } from "node:crypto";
import { readPrivate } from "./storage";
import { extract, ProviderFailure } from "./ai";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import type { ProcessingJob } from "@prisma/client";
export async function claimJob() {
  const token=randomUUID();
  const rows=await db.$queryRaw<ProcessingJob[]>`UPDATE "ProcessingJob" SET status='RUNNING', attempts=attempts+1, "leaseUntil"=NOW()+INTERVAL '90 seconds', "leaseToken"=${token}, "updatedAt"=NOW() WHERE id=(SELECT id FROM "ProcessingJob" WHERE ((status='QUEUED' AND "runAt"<=NOW()) OR (status='RUNNING' AND "leaseUntil"<NOW())) AND attempts<3 ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
  return rows[0] || null;
}
export async function enqueueDueReminders() {
  const rows=await db.reminder.findMany({where:{status:"SCHEDULED",scheduledAt:{lte:new Date()}},select:{id:true},take:100});
  for(const r of rows) await db.processingJob.upsert({where:{idempotencyKey:`reminder:${r.id}`},create:{kind:"REMINDER",idempotencyKey:`reminder:${r.id}`},update:{}});
}
async function parseDocument(id:string) {
  const d=await db.document.findUniqueOrThrow({where:{id}});
  let text=d.sourceText;
  let pages:{num:number;text:string}[]=[];
  if(!text && d.storageKey) {
    const bytes=await readPrivate(d.storageKey);
    if(d.mimeType==="application/pdf") {
      const parser=new PDFParse({data:bytes});
      try {const parsed=await parser.getText({pageJoiner:""});text=parsed.text.trim();pages=parsed.pages;} finally {await parser.destroy();}
      if(!text || text.length<10) throw new ProviderFailure("PDF_TEXT_UNAVAILABLE_MANUAL_ENTRY_REQUIRED");
    } else {
      if(process.env.OCR_ENABLED!=="true") throw new ProviderFailure("OCR_UNAVAILABLE_MANUAL_ENTRY_REQUIRED");
      const ocr=await createWorker(["eng","hin"],1,{logger:()=>{}});
      try {text=(await ocr.recognize(Buffer.from(bytes))).data.text.trim();} finally {await ocr.terminate();}
      if(!text) throw new ProviderFailure("OCR_NO_TEXT_MANUAL_ENTRY_REQUIRED");
    }
    await db.document.update({where:{id},data:{sourceText:text}});
  }
  if(!text) throw new ProviderFailure("NO_SOURCE_TEXT");
  if(text.length>100000) throw new ProviderFailure("DOCUMENT_TEXT_TOO_LARGE");
  const result=await extract(text);
  if(pages.length)for(const i of result.instructions) {const norm=(s:string)=>s.replace(/\s+/g," ").trim().toLowerCase();const page=pages.find(p=>norm(p.text).includes(norm(i.sourcePassage)));i.sourceLocation=page?`Page ${page.num}`:"Extracted text; passage spans pages";}
  return {document:d,result};
}
export async function runJob(job: ProcessingJob) {
  const heartbeat=setInterval(()=>{void db.processingJob.updateMany({where:{id:job.id,status:"RUNNING",leaseToken:job.leaseToken},data:{leaseUntil:new Date(Date.now()+90000)}}).catch(()=>{});},15000);
  try {
    if(job.kind==="DOCUMENT" && job.documentId) {
      const {document:d,result}=await parseDocument(job.documentId);
      await db.$transaction(async tx=> {
        await tx.$queryRaw`SELECT id FROM "ProcessingJob" WHERE id=${job.id} FOR UPDATE`;
        const held=await tx.processingJob.findUniqueOrThrow({where:{id:job.id}});
        if(held.leaseToken!==job.leaseToken || held.status!=="RUNNING") throw new ProviderFailure("LEASE_LOST");
        if(!(await tx.carePlanVersion.findFirst({where:{documentId:d.id}}))) {
          const p=await tx.carePlan.create({data:{patientId:d.patientId,title:d.name.replace(/\.[a-z]+$/i,""),dataMode:mode}});
          const v=await tx.carePlanVersion.create({data:{planId:p.id,number:1,documentId:d.id,method:result.method}});
          for(const i of result.instructions) await tx.careInstruction.create({data:{...i,followUpAt:i.followUpAt?new Date(i.followUpAt):null,versionId:v.id}});
          await tx.auditEvent.create({data:{actorId:d.uploadedById,action:"DOCUMENT_EXTRACTION_DRAFTED",resourceId:v.id}});
        }
        await tx.document.update({where:{id:d.id},data:{status:"READY",errorCode:null}});
        await tx.processingJob.update({where:{id:job.id},data:{status:"SUCCEEDED",leaseUntil:null,leaseToken:null,errorCode:null}});
      });
    } else if(job.kind==="REMINDER") {
      const id=job.idempotencyKey.replace("reminder:","");
      await db.$transaction(async tx=> {
        await tx.$queryRaw`SELECT id FROM "ProcessingJob" WHERE id=${job.id} FOR UPDATE`;
        const held=await tx.processingJob.findUniqueOrThrow({where:{id:job.id}});
        if(held.leaseToken!==job.leaseToken || held.status!=="RUNNING") throw new ProviderFailure("LEASE_LOST");
        const r=await tx.reminder.findUnique({where:{id},include:{instruction:{include:{version:{include:{plan:{include:{patient:true}}}}}}}});
        if(r && r.status==="SCHEDULED") {
          if(r.instruction.version.plan.approvedVersionId!==r.instruction.versionId) await tx.reminder.update({where:{id},data:{status:"SUPERSEDED"}});
          else {
            const patientId=r.instruction.version.plan.patientId;
            const grants=await tx.familyAccessGrant.findMany({where:{patientId,revokedAt:null,permissions:{has:"REMINDERS"}}});
            const ids=[r.instruction.version.plan.patient.userId,...grants.map(g=>g.familyId)];
            for(const userId of ids) await tx.notification.upsert({where:{dedupeKey:`reminder:${id}:${userId}`},create:{userId,reminderId:id,dedupeKey:`reminder:${id}:${userId}`,title:"Your selected reminder time",body:"A reminder you scheduled is ready. Open your approved care plan."},update:{}});
            await tx.reminder.update({where:{id},data:{status:"NOTIFIED",notifiedAt:new Date()}});
            await tx.auditEvent.create({data:{actorId:r.createdById,action:"REMINDER_NOTIFICATION_CREATED",resourceId:id}});
          }
        }
        await tx.processingJob.update({where:{id:job.id},data:{status:"SUCCEEDED",leaseUntil:null,leaseToken:null}});
      });
    } else throw new ProviderFailure("UNKNOWN_JOB_KIND");
  } catch(error) {
    const code=error instanceof ProviderFailure?error.code:"PROCESSING_FAILED";
    const permanent=/UNAVAILABLE_MANUAL|UNSUPPORTED_SOURCE|TEXT_TOO_LARGE|NO_SOURCE_TEXT|AI_NOT_CONFIGURED|UNKNOWN_JOB/.test(code);
    const exhausted=permanent || job.attempts>=3;
    await db.$transaction(async tx=> {
      const changed=await tx.processingJob.updateMany({where:{id:job.id,leaseToken:job.leaseToken,status:"RUNNING"},data:{status:exhausted?"FAILED":"QUEUED",runAt:new Date(Date.now()+job.attempts*10000),leaseToken:null,leaseUntil:null,errorCode:code}});
      if(changed.count && job.documentId) await tx.document.update({where:{id:job.documentId},data:{status:exhausted?"FAILED":"QUEUED",errorCode:code}});
    });
  } finally { clearInterval(heartbeat); }
}
export async function tick() {
  const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});
  if(guard?.mode!==mode) throw new Error("ENVIRONMENT_MISMATCH");
  await enqueueDueReminders();
  await db.$transaction(async tx=>{const exhausted=await tx.$queryRaw<{documentId:string|null}[]>`UPDATE "ProcessingJob" SET status='FAILED', "errorCode"='LEASE_RETRIES_EXHAUSTED', "leaseToken"=NULL, "leaseUntil"=NULL WHERE status='RUNNING' AND attempts>=3 AND "leaseUntil"<NOW() RETURNING "documentId"`;const ids=exhausted.map(j=>j.documentId).filter((id):id is string=>!!id);if(ids.length)await tx.document.updateMany({where:{id:{in:ids},status:{not:"READY"}},data:{status:"FAILED",errorCode:"LEASE_RETRIES_EXHAUSTED"}});});
  const job=await claimJob(); if(job) await runJob(job); return !!job;
}
