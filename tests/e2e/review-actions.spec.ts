import {test,expect,request} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "better-auth/crypto";
test("generation and source approval work independently with clear blockers and private draft translations",async({page})=>{
 test.skip(process.env.APP_MODE!=="normal","Use isolated normal verification.");
 if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw Error("Use isolated test database.");
 const db=new PrismaClient(),origin=process.env.BETTER_AUTH_URL!,stamp=Date.now(),password="Review-actions-verification-2026!",source="Bring this fictional care plan to the appointment.";
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 try{
  await db.rateLimit.deleteMany({where:{key:{not:{startsWith:"app:"}}}});
  const patient=await db.user.create({data:{name:"TEST review actions patient",email:`review-patient-${stamp}@example.test`,role:"PATIENT",dataMode:"normal",profile:{create:{language:"en"}}},include:{profile:true}});
  const doctor=await db.user.create({data:{name:"TEST review actions doctor",email:`review-doctor-${stamp}@example.test`,emailVerified:true,role:"CLINICIAN",dataMode:"normal"}});
  await db.account.create({data:{accountId:doctor.id,userId:doctor.id,providerId:"credential",password:await hashPassword(password)}});
  const patientId=patient.profile!.id;await db.clinicianPatientAssignment.create({data:{clinicianId:doctor.id,patientId}});
  expect((await api.post("/api/auth/sign-in/email",{data:{email:doctor.email,password}})).ok()).toBe(true);await page.context().addCookies((await api.storageState()).cookies);
  const make=async(title:string,reviewed:boolean)=>{const document=await db.document.create({data:{patientId,uploadedById:doctor.id,name:title,mimeType:"text/plain",sourceText:source,status:"READY"}});const plan=await db.carePlan.create({data:{patientId,dataMode:"normal",title}});return db.carePlanVersion.create({data:{planId:plan.id,documentId:document.id,number:1,method:"review action test fixture",instructions:{create:{kind:"CARE",title,sourcePassage:source,reviewState:reviewed?"REVIEWED":"DRAFT"}}},include:{instructions:true}});};
  const direct=await make("Publish source directly",false);
  await page.goto(`/app/review?patientId=${patientId}`);
  await page.getByRole("button",{name:"Generate draft explanations",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog")).toContainText("Publish source directly");await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Approve and publish",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Review required");await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  expect((await api.post(`/api/v1/versions/${direct.id}/approve`,{data:{publishSourceOnly:true}})).status()).toBe(409);
  await page.getByRole("button",{name:"Confirm extraction review",exact:true}).click();await expect(page.getByRole("button",{name:"Approve and publish",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Approve and publish",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("unreviewed explanations and translations stay private");await page.getByRole("button",{name:"Publish reviewed instructions",exact:true}).click();
  await expect(page.getByText("Approved and published. The patient now receives this version.")).toBeVisible();
  const original=await db.carePlanVersion.findUniqueOrThrow({where:{id:direct.id},include:{instructions:{include:{explanations:true}}}});expect(original.status).toBe("APPROVED");expect(original.instructions[0].explanations).toHaveLength(0);expect(original.instructions[0]).toMatchObject({sourcePassage:source,reviewState:"APPROVED"});
  await db.account.create({data:{accountId:patient.id,userId:patient.id,providerId:"credential",password:await hashPassword(password)}});
  const patientApi=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
  try{expect((await patientApi.post("/api/auth/sign-in/email",{data:{email:patient.email,password}})).ok()).toBe(true);const w=(await(await patientApi.get("/api/v1/workspace")).json()).data;expect(w.plans[0].versions[0].instructions[0]).toMatchObject({sourcePassage:source,reviewState:"APPROVED",explanations:[]});}finally{await patientApi.dispose();}
  const generated=await make("Generate independently",true);await page.reload();await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(generated.id);
  await page.getByRole("button",{name:"Generate draft explanations",exact:true}).click();await expect(page.getByRole("textbox",{name:"English explanation",exact:true})).toHaveValue(source);await expect(page.getByRole("textbox",{name:"English explanation",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"Confirm English review",exact:true}).click();
  await expect.poll(async()=>(await db.instructionExplanation.findUniqueOrThrow({where:{instructionId_language:{instructionId:generated.instructions[0].id,language:"en"}}})).status).toBe("REVIEWED");
  expect((await api.post(`/api/v1/versions/${generated.id}/generate`)).ok()).toBe(true);
  expect((await db.instructionExplanation.findUniqueOrThrow({where:{instructionId_language:{instructionId:generated.instructions[0].id,language:"en"}}})).status).toBe("REVIEWED");
  await page.getByRole("button",{name:"Approve and publish",exact:true}).click();await page.getByRole("button",{name:"Publish reviewed instructions",exact:true}).click();await expect(page.getByText("Approved and published. The patient now receives this version.")).toBeVisible();
  const translations=await db.instructionExplanation.findMany({where:{instructionId:generated.instructions[0].id}});expect(translations.find(e=>e.language==="en")!.status).toBe("APPROVED");expect(translations.filter(e=>e.language!=="en").every(e=>e.status==="DRAFT")).toBe(true);
 }finally{await api.dispose();await db.$disconnect();}
});
