import "dotenv/config";
import { db, mode } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import {normalizeUsername,usernamePattern} from "../src/lib/usernames";
async function main() {
  if(mode!=="normal") throw new Error("Controlled provisioning is for a normal environment.");
  const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});
  if(guard && guard.mode!=="normal") throw new Error("Use a separate normal database.");
  const email=z.email().parse(process.env.CLINICIAN_EMAIL?.trim().toLowerCase());const name=z.string().min(2).parse(process.env.CLINICIAN_NAME);const password=z.string().min(12).max(128).parse(process.env.CLINICIAN_PASSWORD);
  const username=process.env.CLINICIAN_USERNAME?normalizeUsername(process.env.CLINICIAN_USERNAME):undefined;
  if(username && !usernamePattern.test(username))throw new Error("Invalid username.");
  await db.environmentGuard.upsert({where:{id:"environment"},create:{id:"environment",mode:"normal"},update:{}});
  const hashed=await hashPassword(password);
  await db.$transaction(async tx=>{const user=await tx.user.create({data:{name,email,username,role:"CLINICIAN",dataMode:"normal",emailVerified:true}});await tx.account.create({data:{userId:user.id,accountId:user.id,providerId:"credential",password:hashed}});});
  console.log("Medical expert provisioned. Sign in at /expert/signin and use Connect patient to assign care by email or username.");
}
main().catch(()=>{console.error("Clinician provisioning failed. Check the controlled environment and required account fields.");process.exitCode=1;}).finally(()=>db.$disconnect());
