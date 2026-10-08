import {sleep} from "workflow";
async function processJob(id:string){
  "use step";
  const {db,mode}=await import("../lib/db");const {runJob}=await import("../lib/worker");const {randomUUID}=await import("node:crypto");
  if((await db.environmentGuard.findUnique({where:{id:"environment"}}))?.mode!==mode)throw new Error("ENVIRONMENT_MISMATCH");
  const token=randomUUID();
  const rows=await db.$queryRaw<import("@prisma/client").ProcessingJob[]>`UPDATE "ProcessingJob" SET status='RUNNING', attempts=attempts+1, "leaseUntil"=NOW()+INTERVAL '90 seconds', "leaseToken"=${token}, "updatedAt"=NOW() WHERE id=${id} AND ((status='QUEUED' AND "runAt"<=NOW()) OR (status='RUNNING' AND "leaseUntil"<NOW())) AND attempts<3 RETURNING *`;
  if(rows[0])await runJob(rows[0]);
  const job=await db.processingJob.findUnique({where:{id}});if(!job || job.status==="SUCCEEDED" || job.status==="FAILED")return null;
  if(job.attempts>=3 && job.status==="RUNNING" && job.leaseUntil && job.leaseUntil<=new Date()){await db.$transaction(async tx=>{const changed=await tx.processingJob.updateMany({where:{id,status:"RUNNING",leaseToken:job.leaseToken},data:{status:"FAILED",errorCode:"LEASE_RETRIES_EXHAUSTED",leaseToken:null,leaseUntil:null}});if(changed.count&&job.documentId)await tx.document.update({where:{id:job.documentId},data:{status:"FAILED",errorCode:"LEASE_RETRIES_EXHAUSTED"}});});return null;}
  return new Date(Math.max(Date.now()+1000,(job.leaseUntil||job.runAt).getTime()));
}
export async function documentJobWorkflow(id:string){"use workflow";let next=await processJob(id);while(next){await sleep(next);next=await processJob(id);}}
async function reminderSchedule(id:string){"use step";const {db}=await import("../lib/db");const reminder=await db.reminder.findUnique({where:{id}});return reminder?.status==="SCHEDULED"?reminder.scheduledAt:null;}
async function enqueueReminder(id:string){"use step";const {db}=await import("../lib/db");const reminder=await db.reminder.findUnique({where:{id}});if(reminder?.status!=="SCHEDULED")return null;const job=await db.processingJob.upsert({where:{idempotencyKey:`reminder:${id}`},create:{kind:"REMINDER",idempotencyKey:`reminder:${id}`},update:{}});return job.id;}
export async function reminderWorkflow(id:string){"use workflow";const scheduledAt=await reminderSchedule(id);if(!scheduledAt)return;await sleep(scheduledAt);const job=await enqueueReminder(id);if(!job)return;let next=await processJob(job);while(next){await sleep(next);next=await processJob(job);}}
