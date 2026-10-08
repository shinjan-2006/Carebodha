import "dotenv/config";
import { db, mode } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";
import { demoSources, extract, draftExplanation } from "../src/lib/ai";
import { mkdir, writeFile } from "node:fs/promises";
async function main() {
  if(process.env.NODE_ENV==="production" || mode!=="demo") throw new Error("Demo seeding is only allowed in a non-production demo environment.");
  const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});
  if(guard && guard.mode!=="demo") throw new Error("Use a separate database for demo data.");
  await db.environmentGuard.upsert({where:{id:"environment"},create:{id:"environment",mode:"demo"},update:{}});
  const password=process.env.DEMO_SEED_PASSWORD;
  if(!password || password.length<12) throw new Error("Set DEMO_SEED_PASSWORD to 12 or more characters.");
  const definitions=[{id:"clinician-demo",name:"Dr. Ananya Sen",email:"clinician@carebodha.demo",role:"CLINICIAN"},
    {id:"patient-demo",name:"Asha Sharma",email:"patient@carebodha.demo",role:"PATIENT"},
    {id:"ravi-demo",name:"Ravi Kumar",email:"ravi@carebodha.demo",role:"PATIENT"},
    {id:"meera-demo",name:"Meera Patel",email:"meera@carebodha.demo",role:"PATIENT"},
    {id:"family-demo",name:"Priya Sharma",email:"family@carebodha.demo",role:"FAMILY"}];
  for(const d of definitions) {
    const existing=await db.user.findUnique({where:{email:d.email}});
    if(existing) {if(existing.dataMode!=="demo") throw new Error("Non-demo user collision.");continue;}
    await db.user.create({data:{...d,dataMode:"demo",emailVerified:true,accounts:{create:{accountId:d.id,providerId:"credential",password:await hashPassword(password)}},...(d.role==="PATIENT"?{profile:{create:{id:`profile-${d.id}`,language:d.id==="patient-demo"?"hi":"en"}}}:{})}});
  }
  const ids=["patient-demo","ravi-demo","meera-demo"];
  await mkdir("demo-documents",{recursive:true});
  for(let n=0;n<3;n++) {
    const patientId=`profile-${ids[n]}`;
    await db.clinicianPatientAssignment.upsert({where:{clinicianId_patientId:{clinicianId:"clinician-demo",patientId}},create:{clinicianId:"clinician-demo",patientId},update:{}});
    await writeFile(`demo-documents/discharge-${n+1}.txt`,demoSources[n]);
    if(await db.carePlan.findUnique({where:{id:`plan-demo-${n}`}})) continue;
    const d=await db.document.create({data:{id:`document-demo-${n}`,patientId,uploadedById:"clinician-demo",name:["Recovery care plan","Daily care plan","Follow-up care plan"][n],mimeType:"text/plain",sourceText:demoSources[n],status:"READY"}});
    const p=await db.carePlan.create({data:{id:`plan-demo-${n}`,patientId,title:d.name,dataMode:"demo"}});
    const extracted=await extract(demoSources[n]);
    for(let versionNumber=1;versionNumber<=(n===0?2:1);versionNumber++) {
      const approved=versionNumber===1;
      const v=await db.carePlanVersion.create({data:{id:`version-demo-${n}-${versionNumber}`,planId:p.id,documentId:d.id,number:versionNumber,method:"demo",status:approved?"APPROVED":"DRAFT",approvedAt:approved?new Date():null}});
      for(let k=0;k<extracted.instructions.length;k++) {
        const instruction=extracted.instructions[k];
        const i=await db.careInstruction.create({data:{...instruction,id:`instruction-demo-${n}-${versionNumber}-${k}`,followUpAt:instruction.followUpAt?new Date(instruction.followUpAt):null,versionId:v.id,reviewState:approved?"APPROVED":"REVIEWED"}});
        for(const language of ["en","hi"] as const) {
          const draft=await draftExplanation(instruction,language);
          await db.instructionExplanation.create({data:{instructionId:i.id,language,...draft,status:approved?"APPROVED":"REVIEWED"}});
        }
      }
      if(approved) {await db.carePlan.update({where:{id:p.id},data:{approvedVersionId:v.id}}); await db.approvalRecord.create({data:{versionId:v.id,clinicianId:"clinician-demo"}});}
    }
  }
  if(!(await db.familyAccessGrant.findUnique({where:{patientId_familyId:{patientId:"profile-ravi-demo",familyId:"family-demo"}}}))) await db.familyAccessGrant.create({data:{patientId:"profile-ravi-demo",familyId:"family-demo",permissions:["READ","TEACH_BACK","CLARIFY","REMINDERS"]}});
  await db.notification.upsert({where:{dedupeKey:"demo-welcome"},create:{userId:"patient-demo",dedupeKey:"demo-welcome",title:"Welcome to CareBodha",body:"Your fictional care plan is ready to read. You can choose English or Hindi."},update:{}});
  console.log("Demo seeded: clinician@carebodha.demo, patient@carebodha.demo, family@carebodha.demo. Use DEMO_SEED_PASSWORD from your local .env.");
}
main().then(()=>db.$disconnect()).catch(async(error)=>{console.error("Seed failed:", error instanceof Error ? error.name : "Unknown error", error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "Check configuration and database.");await db.$disconnect();process.exit(1);});
