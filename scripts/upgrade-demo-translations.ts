import "dotenv/config";
import {db,mode} from "../src/lib/db";
import {demoSources,extract,draftExplanation} from "../src/lib/ai";
async function main(){
  if(mode!=="demo" || process.env.NODE_ENV==="production")throw new Error("Demo fixture corrections require a non-production demo database.");
  for(const n of [1,2]){
    const p=await db.carePlan.findUnique({where:{id:`plan-demo-${n}`},include:{approvedVersion:{include:{instructions:{include:{explanations:true}}}},versions:true}});if(!p?.approvedVersion)continue;
    const source=(await extract(demoSources[n])).instructions;
    const corrected=await Promise.all(source.map(async i=>({instruction:i,en:await draftExplanation(i,"en"),hi:await draftExplanation(i,"hi")})));
    const needsCorrection=p.approvedVersion.instructions.some(i=>i.kind==="CARE" && i.explanations.find(e=>e.language==="hi")?.text===i.sourcePassage);if(!needsCorrection)continue;
    if(p.versions.some(v=>v.status==="DRAFT"))throw new Error("Review the existing demo draft before upgrading its translation.");
    await db.$transaction(async tx=>{
      const v=await tx.carePlanVersion.create({data:{planId:p.id,number:Math.max(...p.versions.map(v=>v.number))+1,status:"APPROVED",documentId:p.approvedVersion!.documentId,method:"demo",approvedAt:new Date()}});
      for(const c of corrected){const i=await tx.careInstruction.create({data:{...c.instruction,followUpAt:c.instruction.followUpAt?new Date(c.instruction.followUpAt):null,versionId:v.id,reviewState:"APPROVED"}});for(const language of ["en","hi"] as const)await tx.instructionExplanation.create({data:{instructionId:i.id,language,...c[language],status:"APPROVED"}});}
      await tx.approvalRecord.create({data:{versionId:v.id,clinicianId:"clinician-demo"}});await tx.carePlan.update({where:{id:p.id},data:{approvedVersionId:v.id}});await tx.auditEvent.create({data:{actorId:"clinician-demo",action:"DEMO_TRANSLATION_FIXTURE_APPROVED",resourceId:v.id}});
    });
  }
  console.log("Fictional Hindi care-instruction fixtures updated through new plan versions. Previous approvals preserved.");
}
main().catch(()=>{console.error("Demo translation update failed. Check the isolated demo environment and existing drafts.");process.exitCode=1;}).finally(()=>db.$disconnect());
