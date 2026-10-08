import {z} from "zod";
import {db} from "./db";
import {HttpError,requireClinician,type Actor} from "./security";
import {normalizeUsername,usernamePattern} from "./usernames";

/** Authorized experts connect an exact registered patient identifier directly. */
export async function assignPatient(user:Actor,body:unknown) {
  requireClinician(user);
  const {identifier}=z.object({identifier:z.string().trim().min(3).max(254)}).strict().parse(body);
  const normalized=identifier.toLowerCase(),email=z.email().safeParse(normalized);
  const username=normalizeUsername(normalized.replace(/^@/,""));
  if(!email.success && !usernamePattern.test(username))throw new HttpError(422,"INVALID_IDENTIFIER","Enter a complete patient email address or a valid username.");
  return db.$transaction(async tx=>{
    const target=await tx.user.findUnique({where:email.success?{email:normalized}:{username},select:{id:true,name:true,role:true,dataMode:true,profile:{select:{id:true}}}});
    if(!target?.profile || target.role!=="PATIENT" || target.dataMode!==user.dataMode)throw new HttpError(404,"PATIENT_NOT_FOUND","No registered patient matches that email or username. Ask the patient to create their CareBodha account first.");
    const key={clinicianId:user.id,patientId:target.profile.id};
    const existing=await tx.clinicianPatientAssignment.findUnique({where:{clinicianId_patientId:key}});
    const assignment=await tx.clinicianPatientAssignment.upsert({where:{clinicianId_patientId:key},create:key,update:{}});
    if(!existing){
      await tx.notification.upsert({where:{dedupeKey:`expert-assigned:${assignment.id}`},create:{userId:target.id,dedupeKey:`expert-assigned:${assignment.id}`,title:"Medical expert connected",body:`${user.name} is now connected to your care. Their reviewed and approved care plans will appear in CareBodha.`},update:{}});
      await tx.auditEvent.create({data:{actorId:user.id,action:"PATIENT_ASSIGNED",resourceId:assignment.id}});
    }
    return {patientId:target.profile.id,message:`${target.name} is connected. You can now upload, review, and publish their care plan.`,alreadyAssigned:!!existing};
  });
}
