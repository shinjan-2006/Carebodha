import "dotenv/config";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {hashPassword,verifyPassword} from "better-auth/crypto";
import {db,mode} from "../src/lib/db";
import {instructionSchema,sourceGrounded} from "../src/lib/contracts";
import {approve,createDraft,workspace} from "../src/lib/services";

const banner="FICTIONAL TRAINING PRESCRIPTION — NOT FOR REAL PATIENT CARE. Training medicines do not exist. Approval in this fixture is a simulated test-doctor action, not a medical professional's endorsement.";
const cases=[
  {key:"asha",name:"Asha Sharma",doctor:"dr.ananya@carebodha.test",title:"Medication routine",medicine:"TRAINING TABLET A",frequency:"once daily",timing:"after breakfast",duration:"7 days",care:"Record a practice reminder in CareBodha. This is a fictional exercise; do not take any medicine.",hi:"CareBodha में अभ्यास के लिए एक रिमाइंडर दर्ज करें। यह काल्पनिक अभ्यास है; कोई दवा न लें।"},
  {key:"ravi",name:"Ravi Sen",doctor:"dr.arjun@carebodha.test",title:"Recovery and follow-up",medicine:"TRAINING TABLET B",frequency:"twice daily",timing:"after breakfast and after dinner",duration:"5 days",care:"Write down a question for the fictional follow-up visit. Do not change or follow a real treatment based on this sample.",hi:"काल्पनिक फॉलो-अप के लिए एक प्रश्न लिखें। इस उदाहरण के आधार पर वास्तविक उपचार का पालन या उसमें बदलाव न करें।"},
  {key:"meera",name:"Meera Das",doctor:"dr.meera@carebodha.test",title:"Daily care check-in",medicine:"TRAINING TABLET C",frequency:"once daily",timing:"after dinner",duration:"3 days",care:"Share your understanding using teach-back, then ask the test doctor about any unclear detail. This sample is not a real prescription.",hi:"अपनी समझ अपने शब्दों में बताएं और अस्पष्ट जानकारी के बारे में परीक्षण डॉक्टर से पूछें। यह वास्तविक प्रिस्क्रिप्शन नहीं है।"}
] as const;
type PatientFixture={key:string;name:string;email:string;username:string;password:string};

async function main(){
  const url=new URL(process.env.DATABASE_URL!),authUrl=new URL(process.env.BETTER_AUTH_URL!);
  if(mode!=="normal" || !["localhost","127.0.0.1"].includes(url.hostname) || url.pathname!=="/carebodha_normal" || !["localhost","127.0.0.1"].includes(authUrl.hostname) || (await db.environmentGuard.findUnique({where:{id:"environment"}}))?.mode!=="normal")throw new Error("Only the local normal test environment is allowed.");
  // Only fixture doctors provisioned by the companion script may receive these records.
  const doctors=await Promise.all(cases.map(c=>db.user.findUniqueOrThrow({where:{email:c.doctor}})));
  if(doctors.some(d=>d.role!=="CLINICIAN" || d.dataMode!=="normal" || !d.name.startsWith("TEST — ") || !d.username?.startsWith("test_dr_")))throw new Error("Provision the local test doctors first.");
  let fixtures:PatientFixture[];
  try{fixtures=JSON.parse(await readFile(".local-test-patients.json","utf8"));}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;fixtures=cases.map(c=>({key:c.key,name:`TEST — ${c.name}`,email:`patient.${c.key}@carebodha.test`,username:`test_patient_${c.key}`,password:`Care!${randomBytes(8).toString("hex")}`}));await writeFile(".local-test-patients.json",JSON.stringify(fixtures,null,2),{flag:"wx"});}
  await mkdir("docs/sample-prescriptions",{recursive:true});
  for(const [index,c] of cases.entries()){
    const fixture=fixtures.find(f=>f.key===c.key);
    if(!fixture || fixture.email!==`patient.${c.key}@carebodha.test` || fixture.username!==`test_patient_${c.key}` || fixture.name!==`TEST — ${c.name}` || fixture.password.length<12)throw new Error("Invalid patient fixture.");
    let patient=await db.user.findUnique({where:{email:fixture.email},include:{accounts:true,profile:true}});
    if(patient){const account=patient.accounts.find(a=>a.providerId==="credential");if(patient.name!==fixture.name || patient.username!==fixture.username || patient.role!=="PATIENT" || patient.dataMode!=="normal" || !patient.profile || !account?.password || !await verifyPassword({hash:account.password,password:fixture.password}))throw new Error("Existing account differs; no existing account was changed.");}
    else{const password=await hashPassword(fixture.password);patient=await db.$transaction(async tx=>{const u=await tx.user.create({data:{name:fixture.name,email:fixture.email,username:fixture.username,role:"PATIENT",dataMode:"normal",emailVerified:true,profile:{create:{language:"en"}}}});await tx.account.create({data:{accountId:u.id,userId:u.id,providerId:"credential",password}});await tx.auditEvent.create({data:{actorId:u.id,action:"LOCAL_TEST_PATIENT_PROVISIONED",resourceId:u.id}});return tx.user.findUniqueOrThrow({where:{id:u.id},include:{accounts:true,profile:true}});});}
    const doctor=doctors[index],patientId=patient.profile!.id;
    await db.clinicianPatientAssignment.upsert({where:{clinicianId_patientId:{clinicianId:doctor.id,patientId}},create:{clinicianId:doctor.id,patientId},update:{}});
    const medication=`SIMULATION ONLY: ${c.medicine}, 1 tablet, oral, ${c.frequency}, ${c.timing}, for ${c.duration}. Do not take this fictional medicine.`;
    const followup="SIMULATION ONLY: Practice follow-up on 2026-10-23 at 10:00 Asia/Kolkata. This is not a real appointment.";
    const passages=[medication,c.care,followup];
    const sourceText=[banner,`Patient: ${fixture.name} (${fixture.email})`,`Test doctor: ${doctor.name} (${doctor.email})`,`Scenario: ${c.title}`,"",...passages].join("\n");
    await writeFile(`docs/sample-prescriptions/${c.key}-prescription.txt`,sourceText+"\n");
    const planId=`local-test-prescription-${c.key}`;
    let plan=await db.carePlan.findUnique({where:{id:planId},include:{versions:true}});
    if(plan && (plan.patientId!==patientId || plan.dataMode!=="normal" || !plan.title.startsWith("TEST ONLY — ")))throw new Error("Plan collision; no existing plan was changed.");
    if(!plan){
      const values=passages.map((sourcePassage,n)=>sourceGrounded(instructionSchema.parse({kind:["MEDICATION","CARE","FOLLOW_UP"][n],title:[`TEST ONLY — ${c.medicine}`,"TEST ONLY — Care exercise","TEST ONLY — Practice follow-up"][n],medicationName:n===0?c.medicine:null,dose:n===0?"1":null,unit:n===0?"tablet":null,route:n===0?"oral":null,frequency:n===0?c.frequency:null,timing:n===0?c.timing:null,duration:n===0?c.duration:null,followUpAt:n===2?"2026-10-23T04:30:00.000Z":null,sourcePassage,sourceLocation:`Training prescription, instruction ${n+1}`,sourceUnclear:false}),sourceText));
      const translations=[`केवल काल्पनिक अभ्यास: ${c.medicine}, 1 tablet, oral, ${c.frequency}, ${c.timing}, ${c.duration}। यह दवा वास्तविक नहीं है; इसे न लें।`,c.hi,"केवल काल्पनिक अभ्यास: 23 अक्टूबर 2026, सुबह 10:00 बजे Asia/Kolkata में फॉलो-अप। यह वास्तविक अपॉइंटमेंट नहीं है।"];
      await db.$transaction(async tx=>{
        const document=await tx.document.create({data:{id:`${planId}-document`,patientId,uploadedById:doctor.id,name:`TEST ONLY — ${c.title} prescription`,mimeType:"text/plain",sourceText,status:"READY"}});
        await tx.carePlan.create({data:{id:planId,patientId,title:`TEST ONLY — ${c.title}`,dataMode:"normal"}});
        const version=await tx.carePlanVersion.create({data:{id:`${planId}-v1`,planId,number:1,documentId:document.id,method:"local fictional training fixture"}});
        for(const [n,value] of values.entries())await tx.careInstruction.create({data:{...value,followUpAt:value.followUpAt?new Date(value.followUpAt):null,versionId:version.id,reviewState:"REVIEWED",explanations:{create:[{language:"en",text:`${banner}\n${value.sourcePassage}`,status:"REVIEWED",sourceFields:[],method:"fictional fixture"},{language:"hi",text:translations[n],status:"REVIEWED",sourceFields:[],method:"fictional fixture"}]}}});
        await tx.auditEvent.create({data:{actorId:doctor.id,action:"LOCAL_FICTIONAL_PRESCRIPTION_CREATED",resourceId:planId}});
      });
      plan=await db.carePlan.findUniqueOrThrow({where:{id:planId},include:{versions:true}});
    }
    // Use the application's existing approval guard, publication and notification logic.
    if(!plan.approvedVersionId)await approve(doctor,`${planId}-v1`);
    if(!await db.carePlanVersion.findFirst({where:{planId,status:"DRAFT"}}) && plan.versions.length===1)await createDraft(doctor,planId);
    const patientView=await workspace(patient),doctorView=await workspace(doctor,patientId);
    if(!patientView.plans.some(p=>p.id===planId && p.versions.length===1 && p.versions[0].status==="APPROVED") || !doctorView.plans.some(p=>p.id===planId && p.versions.some(v=>v.status==="DRAFT")))throw new Error("Fixture publication verification failed.");
  }
  await writeFile("docs/sample-prescriptions/README.md",`# Fictional CareBodha prescriptions\n\n${banner}\n\nEach patient has a published version and a draft requiring the normal review flow. Sign in as the assigned test doctor, choose the patient under Connect patient, then open Care plans or Review. Patient credentials are stored only in the ignored .local-test-patients.json file.\n\n| Test doctor | Patient email / username | Scenario |\n|---|---|---|\n${cases.map(c=>`| ${c.doctor} | patient.${c.key}@carebodha.test / test_patient_${c.key} | ${c.title} |`).join("\n")}\n\nPaste a prescription file into Upload's discharge-text field to practice a new upload. No job or real medical approval is fabricated for uploaded files; use the existing extraction/review process.\n\nSample teach-back for Asha: “In this fictional exercise, TRAINING TABLET A is 1 tablet, oral, once daily, after breakfast, for 7 days.”\n\nIncomplete answer: “I remember a tablet, but I am unsure of the timing.”\n\nMismatch exercise: “For the fictional exercise, I think TRAINING TABLET A is twice daily.”\n\nWith the configured manual provider, answers correctly enter care-team review rather than receiving an invented automatic assessment.\n`);
  console.log(JSON.stringify({patients:fixtures.map(f=>({email:f.email,username:f.username,password:f.password})),prescriptions:3,published:3,reviewDrafts:3,sourceDirectory:"docs/sample-prescriptions"}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Fixture creation failed.");process.exitCode=1;}).finally(()=>db.$disconnect());
