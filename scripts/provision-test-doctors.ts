import "dotenv/config";
import {readFile,writeFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {hashPassword,verifyPassword} from "better-auth/crypto";
import {db,mode} from "../src/lib/db";

type TestDoctor={name:string;email:string;username:string;password:string};
const credentialFile=".local-test-doctors.json";
async function main(){
  const url=new URL(process.env.DATABASE_URL!),authUrl=new URL(process.env.BETTER_AUTH_URL!);
  if(mode!=="normal" || !["localhost","127.0.0.1"].includes(url.hostname) || url.pathname!=="/carebodha_normal" || !["localhost","127.0.0.1"].includes(authUrl.hostname))throw new Error("Test doctors can only be provisioned in the local normal database.");
  if((await db.environmentGuard.findUnique({where:{id:"environment"}}))?.mode!=="normal")throw new Error("Normal environment guard required.");
  let doctors:TestDoctor[];
  try{doctors=JSON.parse(await readFile(credentialFile,"utf8"));}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;doctors=[{name:"TEST — Dr Ananya Sharma",email:"dr.ananya@carebodha.test",username:"test_dr_ananya"},{name:"TEST — Dr Arjun Sen",email:"dr.arjun@carebodha.test",username:"test_dr_arjun"},{name:"TEST — Dr Meera Rao",email:"dr.meera@carebodha.test",username:"test_dr_meera"}].map(doctor=>({...doctor,password:`Care!${randomBytes(8).toString("hex")}`}));await writeFile(credentialFile,JSON.stringify(doctors,null,2),{flag:"wx"});}
  for(const doctor of doctors){
    if(!doctor.email.endsWith("@carebodha.test") || !doctor.name.startsWith("TEST — ") || !doctor.username.startsWith("test_dr_") || doctor.password.length<12)throw new Error("Invalid test fixture.");
    const existing=await db.user.findUnique({where:{email:doctor.email},include:{accounts:true}});
    if(existing){const account=existing.accounts.find(a=>a.providerId==="credential");if(existing.role!=="CLINICIAN" || existing.dataMode!=="normal" || existing.username!==doctor.username || existing.name!==doctor.name || !account?.password || !await verifyPassword({hash:account.password,password:doctor.password}))throw new Error("An existing account differs from this test fixture. It was not changed.");continue;}
    const password=await hashPassword(doctor.password);
    await db.$transaction(async tx=>{const user=await tx.user.create({data:{name:doctor.name,email:doctor.email,username:doctor.username,role:"CLINICIAN",dataMode:"normal",emailVerified:true}});await tx.account.create({data:{userId:user.id,accountId:user.id,providerId:"credential",password}});await tx.auditEvent.create({data:{actorId:user.id,action:"LOCAL_TEST_EXPERT_PROVISIONED",resourceId:user.id}});});
  }
  console.log(JSON.stringify({signIn:"http://localhost:3000/expert/signin",accounts:doctors.map(({email,username,password})=>({email,username,password}))}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Test provisioning failed.");process.exitCode=1;}).finally(()=>db.$disconnect());
