import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
const testUrl=process.env.PHONE_AUTH_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("verified phone account lifecycle (isolated database)",()=>{
 let auth:typeof import("../src/lib/auth").auth,db:typeof import("../src/lib/db").db;
 let requestCount=0;
 const phone="+919000000101",username=`otp_fixture_${Date.now()}`;
 const provider=vi.fn(async(_url:unknown,options?:RequestInit)=>{const form=new URLSearchParams(options?.body as URLSearchParams);return new Response(JSON.stringify({status:form.has("Code")?(form.get("Code")==="624891"?"approved":"pending"):"pending"}));});
 async function post(path:string,body:Record<string,unknown>,purpose="login",cookie=""){
  return auth.handler(new Request(`http://localhost:3001/api/auth${path}`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie,Origin:"http://localhost:3001","x-carebodha-phone-purpose":purpose,"x-forwarded-for":`198.51.100.${++requestCount}`},body:JSON.stringify(body)}));
 }
 beforeAll(async()=>{
  const url=new URL(testUrl!);if(!["localhost","127.0.0.1"].includes(url.hostname)||url.pathname!=="/carebodha_normal_test")throw new Error("Use the isolated local test database.");
  vi.stubEnv("DATABASE_URL",testUrl!);vi.stubEnv("APP_MODE","normal");vi.stubEnv("BETTER_AUTH_URL","http://localhost:3001");vi.stubEnv("PHONE_OTP_PROVIDER","twilio-verify");vi.stubEnv("TWILIO_ACCOUNT_SID",`AC${"a".repeat(32)}`);vi.stubEnv("TWILIO_AUTH_TOKEN","fixture-secret");vi.stubEnv("TWILIO_VERIFY_SERVICE_SID",`VA${"b".repeat(32)}`);vi.stubEnv("SMS_PROVIDER","none");vi.stubGlobal("fetch",provider);
  ({auth}=await import("../src/lib/auth"));({db}=await import("../src/lib/db"));
  await db.environmentGuard.upsert({where:{id:"environment"},create:{id:"environment",mode:"normal"},update:{mode:"normal"}});await db.rateLimit.deleteMany();
  await db.user.deleteMany({where:{phoneNumber:{in:[phone,"+919000000102","+919000000103"]}}});await db.verification.deleteMany({where:{identifier:phone}});
 });
 afterAll(async()=>{if(db)await db.$disconnect();vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it("does not send sign-in OTP to unregistered numbers",async()=>{const calls=provider.mock.calls.length;expect((await post("/phone-number/send-otp",{phoneNumber:phone} )).status).toBe(403);expect(provider.mock.calls.length).toBe(calls);});
 it("creates no account until verification, then creates a patient with a verified phone and username",async()=>{
  expect((await post("/phone-number/send-otp",{phoneNumber:phone},"register")).status).toBe(200);
  expect(await db.user.findUnique({where:{phoneNumber:phone}})).toBeNull();
  expect((await post("/phone-number/verify",{phoneNumber:phone,code:"000000",name:"Fictional Test Patient",password:"FixturePassword!123",username},"register")).status).toBe(400);
  expect(await db.user.findUnique({where:{phoneNumber:phone}})).toBeNull();
  const response=await post("/phone-number/verify",{phoneNumber:phone,code:"624891",name:"Fictional Test Patient",password:"FixturePassword!123",username,role:"CLINICIAN",dataMode:"demo"},"register");
  expect(response.status).toBe(200);expect(response.headers.get("set-cookie")).toContain("session_token");
  const user=await db.user.findUnique({where:{phoneNumber:phone},include:{profile:true}});
  expect(user).toMatchObject({role:"PATIENT",dataMode:"normal",phoneNumberVerified:true,name:"Fictional Test Patient",username});expect(user?.profile).not.toBeNull();
 });
 it("uses passwords for routine login and rejects OTP sign-in",async()=>{expect((await post("/sign-in/username",{username,password:"FixturePassword!123"})).status).toBe(200);expect((await post("/phone-number/send-otp",{phoneNumber:phone})).status).toBe(403);});
 it("resets a password using the registered phone and rejects replay",async()=>{expect((await post("/phone-number/request-password-reset",{phoneNumber:phone})).status).toBe(200);expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"000000",newPassword:"ReplacementPassword!123"})).status).toBe(400);expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"624891",newPassword:"ReplacementPassword!123"})).status).toBe(200);expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"624891",newPassword:"AnotherPassword!123"})).status).toBe(400);expect((await post("/sign-in/username",{username,password:"FixturePassword!123"})).status).toBe(401);expect((await post("/sign-in/username",{username,password:"ReplacementPassword!123"})).status).toBe(200);});
 it("expires recovery challenges and enforces three attempts",async()=>{await post("/phone-number/request-password-reset",{phoneNumber:phone});await db.verification.updateMany({where:{identifier:`${phone}-request-password-reset`},data:{expiresAt:new Date(Date.now()-1000)}});const calls=provider.mock.calls.length;expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"624891",newPassword:"ReplacementPassword!123"})).status).toBe(400);expect(provider.mock.calls.length).toBe(calls);await post("/phone-number/request-password-reset",{phoneNumber:phone});for(let n=0;n<3;n++)expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"000000",newPassword:"ReplacementPassword!123"})).status).toBe(400);expect((await post("/phone-number/reset-password",{phoneNumber:phone,otp:"624891",newPassword:"ReplacementPassword!123"})).status).toBe(400);});
 it("requires phone registration and retains expert password access",async()=>{expect((await post("/sign-up/email",{name:"Other",email:"other@example.test",password:"FixturePassword!123"})).status).toBe(403);const ctx=await auth.$context;const expert=await db.user.create({data:{name:"Fictional expert",email:`${username}@example.test`,role:"CLINICIAN",dataMode:"normal"}});await ctx.internalAdapter.createAccount({userId:expert.id,accountId:expert.id,providerId:"credential",password:await ctx.password.hash("FixturePassword!123")});expect((await post("/sign-in/email",{email:expert.email,password:"FixturePassword!123"})).status).toBe(200);}); it("links a verified replacement phone to the same existing patient account",async()=>{
  const login=await post("/sign-in/username",{username,password:"ReplacementPassword!123"});
  const cookie=login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");expect(cookie).toContain("session_token");
  const existing=await db.user.findUniqueOrThrow({where:{phoneNumber:phone}});
  const replacement="+919000000103";
  expect((await post("/phone-number/send-otp",{phoneNumber:replacement},"update",cookie)).status).toBe(200);
  expect((await post("/phone-number/verify",{phoneNumber:replacement,code:"624891",updatePhoneNumber:true,disableSession:true},"update",cookie)).status).toBe(200);
  expect(await db.user.findUnique({where:{phoneNumber:replacement}})).toMatchObject({id:existing.id,phoneNumberVerified:true});
 });});
