import {db,mode} from "../src/lib/db";
import {hashPassword,verifyPassword} from "better-auth/crypto";
import {z} from "zod";
async function main(){
  if(process.env.VERCEL!=="1"||mode!=="normal")throw new Error("Hosted normal environment required.");
  const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});if(guard && guard.mode!==mode)throw new Error("ENVIRONMENT_MISMATCH");
  await db.environmentGuard.upsert({where:{id:"environment"},create:{id:"environment",mode},update:{}});
  if(process.env.HOSTED_TEST_CLINICIANS){const doctors=z.array(z.object({name:z.string().startsWith("TEST — "),email:z.email().endsWith("@carebodha.test"),username:z.string().regex(/^test_dr_[a-z]+$/),password:z.string().min(12).max(128)}).strict()).max(3).parse(JSON.parse(process.env.HOSTED_TEST_CLINICIANS));
    for(const doctor of doctors){const existing=await db.user.findUnique({where:{email:doctor.email},include:{accounts:true}});if(existing){const account=existing.accounts.find(a=>a.providerId==="credential");if(existing.role!=="CLINICIAN"||existing.dataMode!==mode||existing.username!==doctor.username||existing.name!==doctor.name||!account?.password||!await verifyPassword({hash:account.password,password:doctor.password}))throw new Error("TEST_ACCOUNT_CONFLICT");continue;}
      const password=await hashPassword(doctor.password);await db.$transaction(async tx=>{const user=await tx.user.create({data:{name:doctor.name,email:doctor.email,username:doctor.username,role:"CLINICIAN",dataMode:mode,emailVerified:true}});await tx.account.create({data:{userId:user.id,accountId:user.id,providerId:"credential",password}});await tx.auditEvent.create({data:{actorId:user.id,action:"HOSTED_TEST_EXPERT_PROVISIONED",resourceId:user.id}});});}
  }
  console.log("Hosted normal database initialized; clinical publication still requires review.");
}
main().catch(()=>{console.error("Hosted initialization failed. Check environment guard and controlled account configuration.");process.exitCode=1;}).finally(()=>db.$disconnect());
