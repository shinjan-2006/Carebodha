import {test,expect,request} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "better-auth/crypto";
import {readFileSync} from "node:fs";
test("source upload extracts fields, old drafts recover, and reviewed edits remain versioned",async({page})=>{
 test.skip(process.env.APP_MODE!=="normal","Use the isolated normal verification database.");
 if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw new Error("Use the isolated normal test database.");
 const db=new PrismaClient(),origin=process.env.BETTER_AUTH_URL!,stamp=Date.now(),password="Extraction-verification-2026!";
 const doctorApi=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 const patientApi=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 try{
  // Each isolated browser story gets a fresh auth throttle fixture; production
  // throttling remains enabled and application rate-limit rows are untouched.
  await db.rateLimit.deleteMany({where:{key:{not:{startsWith:"app:"}}}});
  const patient=await db.user.create({data:{name:"Extraction test patient",email:`extract-patient-${stamp}@example.test`,role:"PATIENT",dataMode:"normal",emailVerified:true,profile:{create:{language:"en"}}},include:{profile:true}});
  const doctor=await db.user.create({data:{name:"Extraction test doctor",email:`extract-doctor-${stamp}@example.test`,role:"CLINICIAN",dataMode:"normal",emailVerified:true}});
  for(const u of [patient,doctor])await db.account.create({data:{userId:u.id,accountId:u.id,providerId:"credential",password:await hashPassword(password)}});
  const patientId=patient.profile!.id;await db.clinicianPatientAssignment.create({data:{clinicianId:doctor.id,patientId}});
  expect((await doctorApi.post("/api/auth/sign-in/email",{data:{email:doctor.email,password}})).ok()).toBe(true);
  expect((await patientApi.post("/api/auth/sign-in/email",{data:{email:patient.email,password}})).ok()).toBe(true);
  const source=readFileSync("docs/sample-prescriptions/asha-prescription.txt","utf8");
  const upload=await doctorApi.post("/api/v1/documents",{multipart:{patientId,text:source}});expect(upload.ok()).toBe(true);
  const documentId=(await upload.json()).data.id;
  await expect.poll(async()=>(await db.document.findUniqueOrThrow({where:{id:documentId}})).status,{timeout:30000}).toBe("READY");
  const extracted=await db.carePlanVersion.findFirstOrThrow({where:{documentId},include:{instructions:true}});
  expect(extracted.method).toBe("source field extraction v3");expect(extracted.instructions).toHaveLength(3);
  expect(extracted.instructions.find(i=>i.kind==="MEDICATION")).toMatchObject({medicationName:"TRAINING TABLET A",dose:"1",unit:"tablet",frequency:"once daily",duration:"7 days",reviewState:"DRAFT"});
  expect((await doctorApi.post(`/api/v1/versions/${extracted.id}/approve`)).status()).toBe(409);
  expect((await patientApi.post(`/api/v1/versions/${extracted.id}/extract`)).status()).toBe(403);
  const document=await db.document.create({data:{patientId,uploadedById:doctor.id,name:"Legacy prescription",mimeType:"text/plain",sourceText:source,status:"READY"}});
  const plan=await db.carePlan.create({data:{patientId,dataMode:"normal",title:"Legacy care plan"}});
  const legacy=await db.carePlanVersion.create({data:{planId:plan.id,documentId:document.id,number:1,method:"clinician entry",instructions:{create:{kind:"CARE",title:"Source instruction 1",sourceLocation:"Source paragraph 1",sourcePassage:source.trim()}}}});
  await page.context().addCookies((await doctorApi.storageState()).cookies);
  await page.goto(`/app/review?patientId=${patientId}`);
  await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(legacy.id);
  const medication=page.locator(".extraction-card").filter({has:page.getByRole("heading",{name:"TRAINING TABLET A",exact:true})});
  await expect(medication.getByLabel("dose",{exact:true})).toHaveValue("1");
  await expect(medication.getByLabel("frequency",{exact:true})).toHaveValue("once daily");
  await page.reload();await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(legacy.id);await expect(medication.getByLabel("dose",{exact:true})).toHaveValue("1");
  await db.carePlanVersion.update({where:{id:legacy.id},data:{status:"SUPERSEDED"}});
  const edited=await db.carePlanVersion.create({data:{planId:plan.id,documentId:document.id,number:2,method:"clinician entry",instructions:{create:{kind:"CARE",title:"Doctor's existing edit",sourceLocation:"Source paragraph 1",sourcePassage:source.trim(),reviewState:"REVIEWED"}}}});
  expect((await doctorApi.post(`/api/v1/versions/${edited.id}/extract`)).ok()).toBe(true);expect((await db.carePlanVersion.findUniqueOrThrow({where:{id:edited.id},include:{instructions:true}})).instructions[0].title).toBe("Doctor's existing edit");
  await page.reload();await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(edited.id);
  await page.getByRole("button",{name:"Extract source into a new draft",exact:true}).click();
  await expect(medication.getByLabel("dose",{exact:true})).toHaveValue("1");
  const history=await db.carePlanVersion.findUniqueOrThrow({where:{id:edited.id},include:{instructions:true}});expect(history.status).toBe("SUPERSEDED");expect(history.instructions[0].title).toBe("Doctor's existing edit");
  const fresh=await db.carePlanVersion.findFirstOrThrow({where:{planId:plan.id},orderBy:{number:"desc"},include:{instructions:true}});expect(fresh.number).toBe(3);expect(fresh.instructions.every(i=>i.reviewState==="DRAFT")).toBe(true);
  const bareSource="Metformin 500 mg  1 tablet twice daily  review in 3 months\r\nglimepriride 1 mg  1 table once daily  review in 3 months";
  const bareDoc=await db.document.create({data:{patientId,uploadedById:doctor.id,name:"Unlabelled prescription",mimeType:"text/plain",sourceText:bareSource,status:"READY"}});
  const barePlan=await db.carePlan.create({data:{patientId,dataMode:"normal",title:"Unlabelled prescription"}});
  const v1=await db.carePlanVersion.create({data:{planId:barePlan.id,documentId:bareDoc.id,number:1,method:"source field extraction v1",instructions:{create:{kind:"CARE",title:bareSource,sourceLocation:"Text, line 1",sourcePassage:bareSource}}}});
  await page.reload();await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(v1.id);
  const bareCard=page.locator(".extraction-card").filter({has:page.getByRole("heading",{name:"Metformin 500 mg",exact:true})});
  await expect(bareCard.getByLabel("dose",{exact:true})).toHaveValue("1");await expect(bareCard.getByLabel("frequency",{exact:true})).toHaveValue("twice daily");
  await expect(bareCard.getByLabel("route",{exact:true})).toHaveValue("");await expect(bareCard.getByLabel("duration",{exact:true})).toHaveValue("");
  const followupCard=page.locator(".extraction-card").filter({has:page.getByRole("heading",{name:"review in 3 months",exact:true})});await expect(followupCard.getByLabel("dose",{exact:true})).toHaveCount(0);
  const unclearCard=page.locator(".extraction-card").filter({has:page.getByRole("heading",{name:"glimepriride 1 mg",exact:true})});await expect(unclearCard.getByLabel("unit",{exact:true})).toHaveValue("table");await expect(unclearCard.getByRole("checkbox")).toBeChecked();
  expect((await db.carePlanVersion.findUniqueOrThrow({where:{id:v1.id}})).method).toBe("source field extraction v3");
  await page.screenshot({path:".local-browser-media/extracted-prescription-review.png",fullPage:true});
 }finally{await doctorApi.dispose();await patientApi.dispose();await db.$disconnect();}
});



