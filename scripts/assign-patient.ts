import "dotenv/config";
import { db } from "../src/lib/db";
async function main() {
  const clinician=await db.user.findUniqueOrThrow({where:{email:process.env.CLINICIAN_EMAIL || ""}});
  const patient=await db.user.findUniqueOrThrow({where:{email:process.env.PATIENT_EMAIL || ""},include:{profile:true}});
  if(clinician.role!=="CLINICIAN" || patient.role!=="PATIENT" || !patient.profile || clinician.dataMode!==patient.dataMode) throw new Error("Assignment not permitted.");
  await db.clinicianPatientAssignment.upsert({where:{clinicianId_patientId:{clinicianId:clinician.id,patientId:patient.profile.id}},create:{clinicianId:clinician.id,patientId:patient.profile.id},update:{}});
  console.log("Patient assigned.");
}
main().catch(()=>{console.error("Patient assignment failed. Check account roles, emails, and environment.");process.exitCode=1;}).finally(()=>db.$disconnect());
