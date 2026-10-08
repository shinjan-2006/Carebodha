import {test,expect,request} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "better-auth/crypto";

test.afterEach(async()=>{
  if(process.env.APP_MODE!=="normal")return;
  if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw new Error("Use the isolated normal test database.");
  // Give each independent browser story its own auth-throttle fixture; keep real throttling enabled.
  const db=new PrismaClient();try{await db.rateLimit.deleteMany({where:{key:{not:{startsWith:"app:"}}}});}finally{await db.$disconnect();}
});

test("expert password sign-in connects patients immediately by username or email and publishes reviewed care",async({page})=>{
  test.skip(process.env.APP_MODE!=="normal","Use the isolated normal verification database.");
  const db=new PrismaClient(),origin=process.env.BETTER_AUTH_URL!,stamp=Date.now(),password="Connected-care-password-2026!";
  const username=`patient_${stamp}`,doctorUsername=`doctor_${stamp}`,email=`connected-${stamp}@example.test`;
  const patient=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),anonymous=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
  try{
    expect((await patient.post("/api/auth/sign-up/email",{data:{name:"Connected Patient",email,password,username,role:"CLINICIAN"}})).status()).toBe(200);
    const first=(await (await patient.get("/api/v1/workspace")).json()).data,patientId=first.selectedPatientId;
    expect(first.user.role).toBe("PATIENT");expect(first.user.username).toBe(username);expect(first.plans).toHaveLength(0);
    const doctor=await db.user.create({data:{name:"Dr Verification",email:`expert-${stamp}@example.test`,username:doctorUsername,role:"CLINICIAN",dataMode:"normal",emailVerified:true}});
    await db.account.create({data:{userId:doctor.id,accountId:doctor.id,providerId:"credential",password:await hashPassword(password)}});
    await page.setViewportSize({width:1440,height:1000});await page.goto("/expert/signin");await expect(page.getByRole("heading",{name:"Medical expert sign-in"})).toBeVisible();
    await page.screenshot({path:"docs/screenshots/expert-signin-desktop.png",fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:"docs/screenshots/expert-signin-mobile.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.setViewportSize({width:1440,height:1000});await page.getByLabel("Email or username",{exact:true}).fill(doctorUsername.toUpperCase());await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in as medical expert"}).click();await expect(page).toHaveURL(/\/app\/patients/);
    const doctorApi=page.request;
    expect((await doctorApi.get(`/api/v1/workspace?patientId=${patientId}`)).status()).toBe(403);
    await page.getByLabel("Patient email or username").fill(`@${username.toUpperCase()}`);await page.getByRole("button",{name:"Connect patient",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"Connected Patient is connected"})).toBeVisible();await expect(page.getByRole("heading",{name:"Connected Patient",exact:true})).toBeVisible();
    // The patient performs no acceptance action or additional sign-in between registration and assignment.
    expect(await db.clinicianPatientAssignment.count({where:{clinicianId:doctor.id,patientId}})).toBe(1);
    let w=(await (await patient.get("/api/v1/workspace")).json()).data;expect(w.notifications.some((n:{title:string})=>n.title==="Medical expert connected")).toBe(true);expect(w.plans).toHaveLength(0);
    const post=(path:string,data:unknown)=>doctorApi.post(path,{data,headers:{Origin:origin}});
    const again=await post("/api/v1/patients/assign",{identifier:email.toUpperCase()});expect(again.status()).toBe(200);expect((await again.json()).data.alreadyAssigned).toBe(true);
    expect(await db.notification.count({where:{userId:first.user.id,title:"Medical expert connected"}})).toBe(1);
    expect((await post("/api/v1/patients/assign",{identifier:`missing_${stamp}`})).status()).toBe(404);
    expect((await post("/api/v1/patients/assign",{identifier:doctor.email})).status()).toBe(404);
    const foreign=await db.user.create({data:{name:"Different environment patient",email:`foreign-${stamp}@example.test`,role:"PATIENT",dataMode:"demo",profile:{create:{}}}});
    expect((await post("/api/v1/patients/assign",{identifier:foreign.email})).status()).toBe(404);
    expect((await post("/api/v1/patients/assign",{identifier:"bad identifier"})).status()).toBe(422);
    expect((await anonymous.post("/api/v1/patients/assign",{data:{identifier:email}})).status()).toBe(401);
    expect((await patient.post("/api/v1/patients/assign",{data:{identifier:email}})).status()).toBe(403);
    await page.screenshot({path:"docs/screenshots/expert-patients-desktop.png",fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:"docs/screenshots/expert-patients-mobile.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
    await page.getByRole("link",{name:"Upload care",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/app/upload\\?patientId=${patientId}`));await expect(page.getByRole("heading",{name:"Add a source document"})).toBeVisible();
    const source="Bring your discharge document to the appointment.";
    const upload=await doctorApi.post("/api/v1/documents",{multipart:{patientId,text:source},headers:{Origin:origin}});expect(upload.status()).toBe(200);const documentId=(await upload.json()).data.id;
    await expect.poll(async()=>(await db.document.findUniqueOrThrow({where:{id:documentId}})).status,{timeout:20000}).toBe("READY");
    w=(await (await doctorApi.get(`/api/v1/workspace?patientId=${patientId}`)).json()).data;
    const version=w.plans[0].versions[0],instruction=version.instructions[0],fields=["kind","title","medicationName","dose","unit","route","frequency","timing","duration","followUpAt","sourcePassage","sourceLocation","sourceUnclear"];
    expect((await post(`/api/v1/versions/${version.id}/approve`,{})).status()).toBe(409);
    expect((await doctorApi.patch(`/api/v1/instructions/${instruction.id}`,{data:{instruction:Object.fromEntries(fields.map(f=>[f,instruction[f]])),reviewed:true},headers:{Origin:origin}})).status()).toBe(200);
    expect((await post(`/api/v1/versions/${version.id}/generate`,{})).status()).toBe(200);
    w=(await (await doctorApi.get(`/api/v1/workspace?patientId=${patientId}`)).json()).data;
    for(const e of w.plans[0].versions[0].instructions[0].explanations)if(["en","hi"].includes(e.language))expect((await doctorApi.patch(`/api/v1/explanations/${e.id}`,{data:{text:e.language==="en"?source:"मुलाकात में अपना डिस्चार्ज दस्तावेज़ साथ लाएँ।",reviewed:true},headers:{Origin:origin}})).status()).toBe(200);
    expect((await post(`/api/v1/versions/${version.id}/approve`,{})).status()).toBe(200);
    expect((await (await patient.get("/api/v1/workspace")).json()).data.plans[0].approvedVersionId).toBe(version.id);
    expect((await patient.get(`/api/v1/documents/${documentId}`)).status()).toBe(403);
  }finally{await patient.dispose();await anonymous.dispose();await db.$disconnect();}
});

test("existing email accounts can choose a username once; expert permissions remain controlled",async({page})=>{
  test.skip(process.env.APP_MODE!=="normal","Use the isolated normal verification database.");
  const origin=process.env.BETTER_AUTH_URL!,stamp=Date.now(),email=`identity-${stamp}@example.test`,password="Identity-password-2026!",username=`identity_${stamp}`,db=new PrismaClient();
  const patient=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),other=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
  try{
    expect((await patient.post("/api/auth/sign-up/email",{data:{name:"Identity Patient",email,password}})).status()).toBe(200);
    await page.goto("/signin");await page.getByLabel("Email or username",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/settings");await page.getByLabel("Choose a username",{exact:true}).fill(username);await page.getByRole("button",{name:"Save username"}).click();await expect(page.getByRole("status").filter({hasText:"Username saved"})).toBeVisible();await expect(page.getByText(`@${username}`,{exact:true})).toBeVisible();await page.reload();await expect(page.getByText(`@${username}`,{exact:true})).toBeVisible();
    expect((await patient.post("/api/auth/update-user",{data:{username:`changed_${stamp}`}})).status()).toBe(400);
    expect((await other.post("/api/auth/sign-up/email",{data:{name:"Other Patient",email:`duplicate-${stamp}@example.test`,password,username:username.toUpperCase()}})).status()).toBe(400);
    await page.goto("/expert/signin");await page.getByLabel("Email or username",{exact:true}).fill(username);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in as medical expert"}).click();await expect(page.getByRole("alert").filter({hasText:"does not have medical-expert access"})).toBeVisible();
    const user=await db.user.findUniqueOrThrow({where:{email}});expect(user.role).toBe("PATIENT");expect(await db.clinicianPatientAssignment.count({where:{clinicianId:user.id}})).toBe(0);
    // Family accounts remain unable to connect or assign clinical care.
    await db.user.update({where:{id:user.id},data:{role:"FAMILY"}});expect((await patient.post("/api/v1/patients/assign",{data:{identifier:email}})).status()).toBe(403);
  }finally{await patient.dispose();await other.dispose();await db.$disconnect();}
});
