import {test,expect,request,type APIRequestContext,type Page} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {demoSources} from "../../src/lib/ai";
import {enqueueDueReminders} from "../../src/lib/worker";
import {readFile} from "node:fs/promises";
const db=new PrismaClient({log:[]});
const origin=process.env.BETTER_AUTH_URL || "http://localhost:3000";
const password=process.env.DEMO_SEED_PASSWORD!;
async function login(email:string) {const ctx=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});const res=await ctx.post("/api/auth/sign-in/email",{data:{email,password}});expect(res.status()).toBe(200);return ctx;}
async function post(ctx:APIRequestContext,path:string,data?:unknown) {return ctx.post(`/api/v1/${path}`,{data});}
async function getWorkspace(ctx:APIRequestContext,patientId?:string) {const r=await ctx.get(`/api/v1/workspace${patientId?`?patientId=${patientId}`:""}`);expect(r.status()).toBe(200);return (await r.json()).data;}
async function browserLogin(page:Page,role:"patient"|"clinician"|"family") {
  if(process.env.APP_MODE!=="demo")throw new Error("Browser acceptance uses fictional demo accounts only.");
  await page.goto(`/signin?demo=${role}`);await page.getByRole("button",{name:role,exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Email or username",exact:true})).toHaveValue(`${role}@carebodha.demo`);
  for(let attempt=0;attempt<2;attempt++){
    const result=page.waitForResponse(r=>r.url().endsWith("/api/auth/sign-in/email") && r.request().method()==="POST");await page.getByRole("button",{name:"Sign in",exact:true}).click();const response=await result;
    if(response.status()===429 && attempt===0){const seconds=Number(response.headers()["x-retry-after"] || 10);await new Promise(r=>setTimeout(r,Math.min(30000,seconds*1000+250)));continue;}
    expect(response.status()).toBe(200);return;
  }
}
test.describe.serial("CareBodha full-stack acceptance",()=> {
  let patient:APIRequestContext,clinician:APIRequestContext,family:APIRequestContext;
  let patientId:string,instructionId:string,versionId:string,planId:string;
  const email=`acceptance-${Date.now()}@carebodha.demo`;
  test.beforeAll(async()=> {
    if(process.env.APP_MODE!=="demo" || process.env.NODE_ENV==="production")throw new Error("Use the isolated non-production demo database for acceptance tests.");
    clinician=await login("clinician@carebodha.demo");family=await login("family@carebodha.demo");
    patient=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
    const r=await patient.post("/api/auth/sign-up/email",{data:{email,password,name:"Fictional Acceptance Patient",role:"CLINICIAN"}});expect(r.status()).toBe(200);
    const w=await getWorkspace(patient);expect(w.user.role).toBe("PATIENT");patientId=w.selectedPatientId;
    await db.clinicianPatientAssignment.create({data:{clinicianId:"clinician-demo",patientId}});
  });
  test.afterAll(async()=>{await Promise.all([patient?.dispose(),clinician?.dispose(),family?.dispose()]);await db.$disconnect();});
  test("registration cannot grant clinician privileges; auth, CSRF, and ID access checks",async()=> {
    expect((await patient.get("/api/v1/workspace?patientId=profile-ravi-demo")).status()).toBe(403);
    expect((await family.get(`/api/v1/workspace?patientId=${patientId}`)).status()).toBe(403);
    expect((await post(patient,"versions/version-demo-0-2/approve")).status()).toBe(403);
    const untrusted=await request.newContext({baseURL:origin,storageState:await patient.storageState(),extraHTTPHeaders:{Origin:"https://untrusted.example"}});
    expect((await post(untrusted,"reminders",{})).status()).toBe(403);await untrusted.dispose();
  });
  test("document signature validation and honest processing failure",async()=> {
    const invalid=await clinician.post("/api/v1/documents",{multipart:{patientId,file:{name:"fake.pdf",mimeType:"application/pdf",buffer:Buffer.from("fake document")}}});expect(invalid.status()).toBe(422);
    const unsupported=await clinician.post("/api/v1/documents",{multipart:{patientId,text:"Unsupported demo discharge text; do not invent an extraction."}});expect(unsupported.status()).toBe(200);const id=(await unsupported.json()).data.id;
    await expect.poll(async()=> (await db.document.findUniqueOrThrow({where:{id}})).status,{timeout:20000}).toBe("FAILED");
    expect((await db.document.findUniqueOrThrow({where:{id}})).errorCode).toBe("DEMO_UNSUPPORTED_SOURCE");
    expect((await patient.get(`/api/v1/documents/${id}`)).status()).toBe(403);
  });
  test("real worker extraction remains private until reviewed and approved",async()=> {
    const upload=await clinician.post("/api/v1/documents",{multipart:{patientId,text:demoSources[0]}});expect(upload.status()).toBe(200);const documentId=(await upload.json()).data.id;
    await expect.poll(async()=> (await db.document.findUniqueOrThrow({where:{id:documentId}})).status,{timeout:20000}).toBe("READY");
    const w=await getWorkspace(clinician,patientId);const plan=w.plans.find((p:{versions:{documentId:string}[]})=>p.versions.some(v=>v.documentId===documentId));planId=plan.id;const v=plan.versions[0];versionId=v.id;
    expect((await getWorkspace(patient)).plans.flatMap((p:{versions:unknown[]})=>p.versions)).toHaveLength(0);
    expect((await post(clinician,`versions/${versionId}/approve`)).status()).toBe(409);
    for(const i of v.instructions) {
      const fields=["kind","title","medicationName","dose","unit","route","frequency","timing","duration","followUpAt","sourcePassage","sourceLocation","sourceUnclear"];
      const r=await clinician.patch(`/api/v1/instructions/${i.id}`,{data:{instruction:Object.fromEntries(fields.map(f=>[f,i[f]])),reviewed:true}});expect(r.status()).toBe(200);
    }
    expect((await post(clinician,`versions/${versionId}/generate`)).status()).toBe(200);
    const reviewed=(await getWorkspace(clinician,patientId)).plans.find((p:{id:string})=>p.id===planId).versions[0];
    for(const i of reviewed.instructions) for(const e of i.explanations.filter((e:{text:string})=>e.text)) expect((await clinician.patch(`/api/v1/explanations/${e.id}`,{data:{text:e.text,reviewed:true}})).status()).toBe(200);
    expect((await post(clinician,`versions/${versionId}/approve`)).status()).toBe(200);
    const published=(await getWorkspace(patient)).plans.find((p:{id:string})=>p.id===planId);expect(published.approvedVersionId).toBe(versionId);
    const med=published.versions[0].instructions.find((i:{kind:string})=>i.kind==="MEDICATION");instructionId=med.id;
    expect(med.explanations.find((e:{language:string})=>e.language==="hi").text).toContain("दिन में दो बार");
  });
  test("new draft does not overwrite the published version",async()=> {
    expect((await post(clinician,`plans/${planId}/versions`)).status()).toBe(200);
    const p=(await getWorkspace(patient)).plans.find((p:{id:string})=>p.id===planId);expect(p.approvedVersionId).toBe(versionId);expect(p.versions).toHaveLength(1);
    const versions=await db.carePlanVersion.findMany({where:{planId},orderBy:{number:"asc"}});expect(versions.map(v=>v.status)).toEqual(["APPROVED","DRAFT"]);
  });
  test("real PDF parsing and private storage produce grounded page references",async()=> {
    const buffer=await readFile("demo-documents/discharge-2.pdf");
    const r=await clinician.post("/api/v1/documents",{multipart:{patientId,file:{name:"fictional-discharge.pdf",mimeType:"application/pdf",buffer}}});expect(r.status()).toBe(200);const id=(await r.json()).data.id;
    await expect.poll(async()=> (await db.document.findUniqueOrThrow({where:{id}})).status,{timeout:20000}).toBe("READY");
    const doc=await db.document.findUniqueOrThrow({where:{id}});expect(doc.storageKey).not.toBeNull();expect(doc.sourceText).toContain("Demo Medicine B");
    const v=await db.carePlanVersion.findFirstOrThrow({where:{documentId:id},include:{instructions:true}});expect(v.instructions[0].sourceLocation).toBe("Page 1");
    expect((await clinician.get(`/api/v1/documents/${id}`)).status()).toBe(200);expect((await patient.get(`/api/v1/documents/${id}`)).status()).toBe(403);
  });
  test("frequency, dose, incomplete, unclear, and confirmed voice responses persist",async()=> {
    const submit=(transcript:string,extra={})=>post(patient,"teachback",{instructionId,transcript,inputMode:"TEXT",transcriptConfirmed:true,personType:"PATIENT",...extra});
    const mismatch=await submit("I will take one tablet once daily after food.");expect(mismatch.status()).toBe(200);expect((await mismatch.json()).data.findings.find((f:{fieldName:string})=>f.fieldName==="frequency").status).toBe("MISMATCH");
    const dose=await submit("I will take two tablets twice daily after food.");expect((await dose.json()).data.findings.find((f:{fieldName:string})=>f.fieldName==="dose").status).toBe("MISMATCH");
    const incomplete=await submit("I will take one tablet.");expect((await incomplete.json()).data.status).toBe("INCOMPLETE");
    const unclear=await submit("Maybe one tablet, not sure.");expect((await unclear.json()).data.status).toBe("UNCLEAR");
    expect((await submit("I take one tablet twice daily after food.",{inputMode:"VOICE",transcriptConfirmed:false})).status()).toBe(422);
    const voice=await submit("I take one tablet twice daily after food.",{inputMode:"VOICE",transcriptConfirmed:true});expect((await voice.json()).data.status).toBe("MATCH");
    expect(await db.teachBackAttempt.count({where:{instructionId}})).toBe(5);
  });
  test("invitations are authenticated, expire, and can only be used once",async()=> {
    const r=await post(patient,"invitations",{patientId,email:"family@carebodha.demo",permissions:["READ","TEACH_BACK","REMINDERS","CLARIFY"]});expect(r.status()).toBe(200);const invite=(await r.json()).data;const token=new URL(invite.link).searchParams.get("token");
    expect((await db.familyInvitation.findUniqueOrThrow({where:{id:invite.id}})).tokenHash).not.toBe(token);
    expect((await post(family,"invitations/accept",{token})).status()).toBe(200);expect((await post(family,"invitations/accept",{token})).status()).toBe(410);
    expect((await getWorkspace(family,patientId)).plans.length).toBeGreaterThan(0);
    const expired=await post(patient,"invitations",{patientId,email:"family@carebodha.demo",permissions:["READ"]});const exp=(await expired.json()).data;await db.familyInvitation.update({where:{id:exp.id},data:{expiresAt:new Date(Date.now()-1000)}});
    expect((await post(family,"invitations/accept",{token:new URL(exp.link).searchParams.get("token")})).status()).toBe(410);
  });
  test("granular READ-only family grants cannot use teach-back, reminders, or clarification",async()=> {
    const invite=await post(patient,"invitations",{patientId,email:"family@carebodha.demo",permissions:["READ"]});const link=(await invite.json()).data.link;expect((await post(family,"invitations/accept",{token:new URL(link).searchParams.get("token")})).status()).toBe(200);
    expect((await getWorkspace(family,patientId)).plans.length).toBeGreaterThan(0);
    expect((await post(family,"teachback",{instructionId,transcript:"one tablet",inputMode:"TEXT",transcriptConfirmed:true,personType:"CAREGIVER"})).status()).toBe(403);
    expect((await post(family,"reminders",{instructionId,scheduledAt:new Date(Date.now()+60000).toISOString(),timezone:"Asia/Kolkata"})).status()).toBe(403);
    expect((await post(family,"clarifications",{instructionId,question:"Can you repeat this?"})).status()).toBe(403);
    // Restore explicit patient consent for the following caregiver/revocation check.
    const full=await post(patient,"invitations",{patientId,email:"family@carebodha.demo",permissions:["READ","TEACH_BACK","REMINDERS","CLARIFY"]});expect((await post(family,"invitations/accept",{token:new URL((await full.json()).data.link).searchParams.get("token")})).status()).toBe(200);
  });
  test("caregiver attempts remain separate and revocation is immediate",async()=> {
    const r=await post(family,"teachback",{instructionId,transcript:"one tablet twice daily after food",inputMode:"TEXT",transcriptConfirmed:true,personType:"CAREGIVER"});expect(r.status()).toBe(200);expect((await r.json()).data.personType).toBe("CAREGIVER");
    expect((await post(family,"teachback",{instructionId,transcript:"one tablet",inputMode:"TEXT",transcriptConfirmed:true,personType:"PATIENT"})).status()).toBe(403);
    const grant=await db.familyAccessGrant.findUniqueOrThrow({where:{patientId_familyId:{patientId,familyId:"family-demo"}}});
    expect((await post(patient,`grants/${grant.id}/revoke`)).status()).toBe(200);
    expect((await family.get(`/api/v1/workspace?patientId=${patientId}`)).status()).toBe(403);
    expect((await post(family,"clarifications",{instructionId,question:"Can you clarify this instruction?"})).status()).toBe(403);
  });
  test("clarification requests can be resolved by assigned clinicians",async()=> {
    const question=await post(patient,"clarifications",{instructionId,question:"Could you repeat the approved frequency?"});expect(question.status()).toBe(200);const id=(await question.json()).data.id;
    expect((await patient.patch(`/api/v1/clarifications/${id}`,{data:{response:"Unauthorized response"}})).status()).toBe(403);
    expect((await clinician.patch(`/api/v1/clarifications/${id}`,{data:{response:"Your approved instruction says twice daily. Read the same approved plan; no change is made."}})).status()).toBe(200);
    expect((await db.clarificationRequest.findUniqueOrThrow({where:{id}})).status).toBe("RESOLVED");
    expect(await db.notification.count({where:{dedupeKey:`clarification:${id}`}})).toBe(1);
  });
  test("reminder jobs create notifications idempotently and completion is separate",async()=> {
    const r=await post(patient,"reminders",{instructionId,scheduledAt:new Date(Date.now()+2000).toISOString(),timezone:"Asia/Kolkata"});expect(r.status()).toBe(200);const id=(await r.json()).data.id;
    await expect.poll(async()=>db.notification.count({where:{reminderId:id}}),{timeout:20000}).toBe(1);
    await enqueueDueReminders();await enqueueDueReminders();expect(await db.processingJob.count({where:{idempotencyKey:`reminder:${id}`}})).toBe(1);
    expect((await db.reminder.findUniqueOrThrow({where:{id}})).reportedCompletedAt).toBeNull();
    expect((await patient.patch(`/api/v1/reminders/${id}`,{data:{action:"COMPLETE"}})).status()).toBe(200);
    const reminder=await db.reminder.findUniqueOrThrow({where:{id}});expect(reminder.status).toBe("NOTIFIED");expect(reminder.reportedCompletedAt).not.toBeNull();
    const n=await db.notification.findFirstOrThrow({where:{reminderId:id}});expect((await patient.patch(`/api/v1/notifications/${n.id}`,{data:{}})).status()).toBe(200);expect((await db.notification.findUniqueOrThrow({where:{id:n.id}})).readAt).not.toBeNull();
  });
  test("data survives a new database connection and logout invalidates the session",async()=> {
    const independent=new PrismaClient();expect(await independent.teachBackAttempt.count({where:{instructionId}})).toBe(6);expect((await independent.carePlan.findUniqueOrThrow({where:{id:planId}})).approvedVersionId).toBe(versionId);await independent.$disconnect();
    expect((await patient.post("/api/auth/sign-out",{data:{}})).status()).toBe(200);expect((await patient.get("/api/v1/workspace")).status()).toBe(401);
  });
});
test("real browser: sign in, Hindi plan, mismatch, successful retry, and logout",async({page})=> {
  await browserLogin(page,"patient");await expect(page.getByRole("heading",{name:"Hello, Asha."})).toBeVisible();
  await page.locator('.sidebar a[href="/app/plan"]').click();await expect(page.getByText("Demo Medicine A की एक गोली दिन में दो बार खाने के बाद लें।",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Explain back",exact:true}).first().click();
  await page.getByLabel("In your own words, tell us how you will take this medicine.").fill("I will take one tablet once daily after food.");await page.getByRole("button",{name:"Check my understanding"}).click();
  await expect(page.getByText("You said ‘once daily.’ Your approved instruction says ‘twice daily.’").first()).toBeVisible();
  await page.getByRole("button",{name:"Try again",exact:true}).click();await page.getByLabel("In your own words, tell us how you will take this medicine.").fill("I will take one tablet twice daily after food.");await page.getByRole("button",{name:"Check my understanding"}).click();await expect(page.getByRole("heading",{name:"The checked details agree."})).toBeVisible();
  await page.screenshot({path:"test-results/patient-teachback-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page.getByRole("heading",{name:"Good to see you."})).toBeVisible();
});
test("browser responsive, reduced motion, fallback, focus, and functional landing demo",async({page})=> {
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,contextId:string,...args:unknown[]){if(contextId==="webgl" || contextId==="webgl2")return null;return Reflect.apply(original,this,[contextId,...args]);} as typeof HTMLCanvasElement.prototype.getContext;});
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");await expect(page.getByRole("heading",{name:"UNDERSTAND YOUR CARE",exact:true})).toBeVisible();
  await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
  await expect(page.locator(".static-ribbon")).toBeVisible();await expect(page.locator(".chrome-scene canvas")).toHaveCount(0);
  await page.getByRole("button",{name:"MENU",exact:true}).click();await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();await expect(page.getByRole("link",{name:"How it works",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"MENU",exact:true})).toBeFocused();await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Check my understanding"}).click();await expect(page.getByText("Mismatch detected — frequency")).toBeVisible();
  await page.screenshot({path:"test-results/landing-mobile.png",fullPage:true});
  await browserLogin(page,"patient");await expect(page.getByRole("heading",{name:"Hello, Asha."})).toBeVisible();
  await page.getByRole("button",{name:"Open navigation"}).click();await page.locator('.sidebar a[href="/app/plan"]').click();await expect(page.getByText("Demo Medicine A की एक गोली दिन में दो बार खाने के बाद लें।",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:"test-results/patient-mobile.png",fullPage:true});
});
test("desktop and tablet landing navigation and WebGL fallback remain usable",async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,id:string,...args:unknown[]){return id==="webgl" || id==="webgl2"?null:Reflect.apply(original,this,[id,...args]);} as typeof HTMLCanvasElement.prototype.getContext;});
  await page.setViewportSize({width:1440,height:960});await page.goto("/");await expect(page.locator(".static-ribbon")).toBeVisible();await expect(page.locator(".chrome-scene.is-ready")).toHaveCount(0);
  await page.getByRole("button",{name:"MENU",exact:true}).click();await page.getByRole("link",{name:"How it works",exact:true}).click();await expect(page).toHaveURL(/#how-it-works$/);await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  await page.setViewportSize({width:768,height:1024});await page.getByRole("link",{name:"CareBodha home"}).first().click();await expect(page.getByRole("heading",{name:"UNDERSTAND YOUR CARE",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("link",{name:"TRY THE DEMO",exact:true}).click();await expect(page.getByRole("heading",{name:"Good to see you."})).toBeVisible();await expect(page.getByLabel("Email or username")).toHaveValue("patient@carebodha.demo");
});
test("clinician browser reviews extraction and both languages, then publishes the correct version",async({page})=> {
  const p=await db.patientProfile.findFirstOrThrow({where:{user:{email:{startsWith:"acceptance-"}}},orderBy:{user:{createdAt:"desc"}}});
  const plan=await db.carePlan.findFirstOrThrow({where:{patientId:p.id,title:"Manual discharge text"},include:{versions:{where:{status:"DRAFT"},orderBy:{number:"desc"},take:1}}});
  const draftId=plan.versions[0].id;
  await browserLogin(page,"clinician");await expect(page.getByRole("heading",{name:"Your patients, clearly connected."})).toBeVisible();
  await page.getByRole("combobox",{name:"Assigned patient",exact:true}).selectOption(p.id);const reviewLink=page.getByRole("link",{name:"Care-plan review",exact:true});await expect(reviewLink).toHaveAttribute("href",`/app/review?patientId=${p.id}`);await reviewLink.click();await expect(page.getByRole("combobox",{name:"Plan version",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Plan version",exact:true}).selectOption(draftId);const count=await page.locator(".extraction-card").count();
  for(let n=0;n<count;n++){const card=page.locator(".extraction-card").nth(n);await card.getByRole("button",{name:"Confirm extraction review"}).click();await expect(card.locator(".panel-heading").first().getByText("Reviewed",{exact:true})).toBeVisible();}
  const generated=page.waitForResponse(r=>r.url().endsWith(`/versions/${draftId}/generate`) && r.request().method()==="POST");await page.getByRole("button",{name:"Generate draft explanations"}).click();expect((await generated).status()).toBe(200);
  for(let n=0;n<count;n++){const card=page.locator(".extraction-card").nth(n);for(const language of ["English","Hindi"]){const saved=page.waitForResponse(r=>r.url().includes("/api/v1/explanations/") && r.request().method()==="PATCH");await card.getByRole("button",{name:`Confirm ${language} review`}).click();expect((await saved).status()).toBe(200);}}
  await expect(page.getByRole("button",{name:"Approve and publish"})).toBeEnabled();await page.getByRole("button",{name:"Approve and publish"}).click();await page.getByRole("button",{name:"Publish reviewed instructions",exact:true}).click();await expect(page.getByText("Approved and published. The patient now receives this version.")).toBeVisible();
  expect((await db.carePlan.findUniqueOrThrow({where:{id:plan.id}})).approvedVersionId).toBe(draftId);await page.screenshot({path:"test-results/clinician-review-desktop.png",fullPage:true});
});
test("browser voice transcript requires confirmation and editing clears confirmation",async({page})=> {
  await page.addInitScript(()=> {
    class FixtureRecognition {
      lang="en-IN";continuous=false;interimResults=false;onresult:((e:unknown)=>void)|null=null;onerror:(()=>void)|null=null;onend:(()=>void)|null=null;
      start(){setTimeout(()=>{this.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:"one tablet twice daily after food"}}]});this.onend?.();},100);}stop(){this.onend?.();}
    }
    (window as unknown as {SpeechRecognition:typeof FixtureRecognition}).SpeechRecognition=FixtureRecognition;
  });
  await browserLogin(page,"patient");await expect(page.getByRole("heading",{name:"Hello, Asha."})).toBeVisible();await page.locator('.sidebar a[href="/app/teachback"]').click();
  await page.getByRole("button",{name:"Use my voice"}).click();const confirm=page.getByRole("checkbox",{name:"I reviewed this transcript. These are my words."});await expect(confirm).toBeVisible();await expect(page.getByRole("button",{name:"Check my understanding"})).toBeDisabled();await confirm.check();await expect(page.getByRole("button",{name:"Check my understanding"})).toBeEnabled();
  await page.getByLabel("In your own words, tell us how you will take this medicine.").fill("one tablet once daily after food");await expect(confirm).not.toBeChecked();await expect(page.getByRole("button",{name:"Check my understanding"})).toBeDisabled();await confirm.check();await page.getByRole("button",{name:"Check my understanding"}).click();await expect(page.getByText("You said ‘once daily.’ Your approved instruction says ‘twice daily.’").first()).toBeVisible();
});

