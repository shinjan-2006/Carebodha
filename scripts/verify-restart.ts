import "dotenv/config";
import {db} from "../src/lib/db";
async function main(){
  const user=await db.user.findFirstOrThrow({where:{email:{startsWith:"acceptance-"}},orderBy:{createdAt:"desc"},include:{profile:true}});
  const profile=user.profile!;const attempts=await db.teachBackAttempt.count({where:{version:{plan:{patientId:profile.id}}}});
  const plans=await db.carePlan.findMany({where:{patientId:profile.id},include:{versions:true}});
  const requests=await db.clarificationRequest.count({where:{instruction:{version:{plan:{patientId:profile.id}}},status:"RESOLVED"}});
  const origin=process.env.BETTER_AUTH_URL!;
  const session=await fetch(`${origin}/api/auth/sign-in/email`,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify({email:"clinician@carebodha.demo",password:process.env.DEMO_SEED_PASSWORD})});
  if(!session.ok)throw new Error("Restart sign-in failed");const cookie=session.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  const response=await fetch(`${origin}/api/v1/workspace?patientId=${profile.id}`,{headers:{Cookie:cookie}});if(!response.ok)throw new Error("Restart API failed");const workspace=(await response.json()).data;
  if(attempts<6 || !plans.some(p=>p.approvedVersionId) || requests<1 || workspace.attempts.length!==attempts)throw new Error("Persistence check failed");
  console.log(JSON.stringify({restartPersistence:"PASS",persistedTeachBackAttempts:attempts,persistedPlanVersions:plans.flatMap(p=>p.versions).length,resolvedClarifications:requests,apiMatchesDatabase:true}));
}
main().finally(()=>db.$disconnect());
