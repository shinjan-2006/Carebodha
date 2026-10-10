import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {languages} from "../../src/lib/languages";

test("selected-language dictation retains partial and final phrases and saves only after confirmation",async({page})=>{
 test.skip(process.env.APP_MODE!=="normal","Run against the isolated normal verification database.");
 const db=new PrismaClient();if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw Error("Use the isolated verification database.");
 try{
  const stamp=Date.now(),source="Bring your discharge document to the appointment.",origin=process.env.BETTER_AUTH_URL!;
  expect((await page.request.post("/api/auth/sign-up/email",{headers:{Origin:origin},data:{name:"Voice verification patient",email:`voice-${stamp}@example.test`,password:"Voice-verification-2026!"}})).status()).toBe(200);
  const w=(await(await page.request.get("/api/v1/workspace")).json()).data;
  const plan=await db.carePlan.create({data:{patientId:w.selectedPatientId,title:"Voice test fixture",dataMode:"normal",versions:{create:{number:1,status:"APPROVED",method:"isolated test fixture",approvedAt:new Date(),instructions:{create:{kind:"CARE",title:source,sourcePassage:source,reviewState:"REVIEWED",explanations:{create:[{language:"en",text:source,status:"APPROVED",sourceFields:[],method:"test fixture"},{language:"hi",text:"मुलाकात में अपना डिस्चार्ज दस्तावेज़ साथ लाएँ।",status:"APPROVED",sourceFields:[],method:"test fixture"}]}}}}}},include:{versions:{include:{instructions:true}}}});
  const version=plan.versions[0],instruction=version.instructions[0];
  const translations={bn:"মুলাকাতে আপনার ডিসচার্জ নথি নিয়ে আসুন।",or:"ସାକ୍ଷାତ ସମୟରେ ଆପଣଙ୍କ ଡିସଚାର୍ଜ ଦଲିଲ ଆଣନ୍ତୁ।",te:"అపాయింట్‌మెంట్‌కు మీ డిశ్చార్జ్ పత్రాన్ని తీసుకురండి.",pa:"ਮੁਲਾਕਾਤ ਲਈ ਆਪਣਾ ਡਿਸਚਾਰਜ ਦਸਤਾਵੇਜ਼ ਲਿਆਓ।",ta:"சந்திப்பிற்கு உங்கள் டிஸ்சார்ஜ் ஆவணத்தைக் கொண்டு வாருங்கள்."};
  for(const [language,text] of Object.entries(translations))await db.instructionExplanation.create({data:{instructionId:instruction.id,language,text,status:"APPROVED",sourceFields:[],method:"test fixture"}});await db.carePlan.update({where:{id:plan.id},data:{approvedVersionId:version.id}});await db.careInstruction.update({where:{id:instruction.id},data:{reviewState:"APPROVED"}});
  await page.addInitScript(()=>{
   const instances:MockRecognition[]=[];
   class MockRecognition{
    lang="";continuous=false;interimResults=false;aborted=false;
    onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onerror:((e:{error:string})=>void)|null=null;onresult:((e:unknown)=>void)|null=null;
    constructor(){instances.push(this);}start(){setTimeout(()=>this.onstart?.(),0);}stop(){this.onend?.();}abort(){this.aborted=true;this.onend?.();}
    result(parts:{text:string;final:boolean}[]){this.onresult?.({resultIndex:parts.length-1,results:parts.map(p=>({isFinal:p.final,0:{transcript:p.text}}))});}
   }
   const spoken: {text:string;lang:string}[]=[];
   const synth=Object.assign(new EventTarget(),{getVoices:()=>["en","hi","bn","or","te","pa","ta"].map(code=>({lang:`${code}-IN`,name:code})),cancel:()=>{},speak:(utterance:{text:string;lang:string})=>spoken.push(utterance)});
   Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true});
   Object.assign(window,{SpeechRecognition:MockRecognition,__voiceInstances:instances,__spoken:spoken,SpeechSynthesisUtterance:class {lang="";constructor(public text:string){}}});
  });
  await page.goto("/app/teachback");
  const input=page.locator("#teachback-answer"),button=page.locator(".voice-toolbar button").first(),switcher=page.getByRole("combobox",{name:"Language / भाषा"});
  for(const language of languages){
   await switcher.selectOption(language.code);await expect(page.locator(".pending-indicator")).toHaveCount(0);await expect(page.locator(".voice-input-language")).toContainText(language.native);
   await page.locator(".approved-passage button").click();
   expect(await page.evaluate(()=>(window as unknown as {__spoken:{lang:string}[]}).__spoken.at(-1)?.lang)).toBe(language.locale);
   await button.click();expect(await page.evaluate(()=>{const r=(window as unknown as {__voiceInstances:{lang:string;continuous:boolean;interimResults:boolean}[]}).__voiceInstances.at(-1)!;return {lang:r.lang,continuous:r.continuous,interimResults:r.interimResults};})).toEqual({lang:language.locale,continuous:true,interimResults:true});await button.click();
  }
  await switcher.selectOption("en");await expect(page.locator(".pending-indicator")).toHaveCount(0);await button.click();
  const result=async(parts:{text:string;final:boolean}[])=>page.evaluate(parts=>(window as unknown as {__voiceInstances:{result:(parts:{text:string;final:boolean}[])=>void}[]}).__voiceInstances.at(-1)!.result(parts),parts);
  await result([{text:"I will bring",final:false}]);await expect(input).toHaveValue("I will bring");
  await result([{text:"I will bring",final:true},{text:"my discharge document.",final:false}]);await expect(input).toHaveValue("I will bring my discharge document.");
  await result([{text:"I will bring",final:true},{text:"my discharge document.",final:true}]);await button.click();
  await expect(page.getByRole("button",{name:"Check my understanding",exact:true})).toBeDisabled();
  expect(await db.teachBackAttempt.count({where:{versionId:version.id}})).toBe(0);
  await page.getByLabel("I reviewed this transcript. These are my words.").check();await page.getByRole("button",{name:"Check my understanding",exact:true}).click();
  await expect.poll(()=>db.teachBackAttempt.count({where:{versionId:version.id}})).toBe(1);
  expect(await db.teachBackAttempt.findFirstOrThrow({where:{versionId:version.id}})).toMatchObject({inputMode:"VOICE",transcript:"I will bring my discharge document.",instructionId:instruction.id,status:"NEEDS_CLINICIAN_REVIEW"});
  await page.getByRole("button",{name:"Try again",exact:true}).click();await button.click();
  await page.evaluate(()=>(window as unknown as {__voiceInstances:{onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null}[]}).__voiceInstances.at(-1)!.onerror?.({error:"not-allowed"}));
  await expect(page.getByText("Allow microphone access in your browser, then try again.", {exact:true})).toBeVisible();
  await button.click();await switcher.selectOption("hi");await expect(page.locator(".pending-indicator")).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {__voiceInstances:{aborted:boolean}[]}).__voiceInstances.at(-1)!.aborted)).toBe(true);
  await result([{text:"stale English result",final:true}]);await expect(input).toHaveValue("");
  await page.setViewportSize({width:390,height:844});await expect(page.locator(".voice-input-language")).toContainText("हिन्दी");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const hindi="मैं अपना डिस्चार्ज दस्तावेज़ लाऊँगा।";await button.click();await result([{text:hindi,final:false}]);await expect(input).toHaveValue(hindi);await button.click();
  await page.locator(".teachback-form .checkbox-row input").first().check();await page.locator(".teachback-form form > .button.primary").click();
  await expect.poll(()=>db.teachBackAttempt.count({where:{versionId:version.id,transcript:hindi,inputMode:"VOICE"}})).toBe(1);
  await page.screenshot({path:".local-browser-media/voice-input-hindi-mobile.png",fullPage:true});
  await db.instructionExplanation.deleteMany({where:{instructionId:instruction.id,language:"bn"}});
  await page.reload();await switcher.selectOption("bn");await expect(page.locator(".pending-indicator")).toHaveCount(0);
  await page.locator(".approved-passage button").click();
  const missing=await page.evaluate(()=>(window as unknown as {__spoken:{text:string;lang:string}[]}).__spoken.at(-1)!);
  expect(missing.lang).toBe("en-IN");expect(missing.text).toBe(source);
  await page.evaluate(()=>{Object.assign(window.speechSynthesis,{getVoices:()=>[]});Object.assign(window,{Audio:class {onended=null;play(){return Promise.resolve();}pause(){}}});});
  let audioBody:unknown;
  await page.route("**/api/v1/audio",async route=>{audioBody=route.request().postDataJSON();await route.fulfill({status:200,contentType:"audio/wav",body:Buffer.from("RIFF0000WAVE")});});
  await page.locator(".approved-passage button").click();
  await expect(page.getByText("অডিও শুরু হয়েছে। অনুমোদিত পাঠ পড়তে পারবেন।",{exact:true})).toBeVisible();
  expect(audioBody).toEqual({instructionId:instruction.id,language:"en"});
  await page.unroute("**/api/v1/audio");
  await page.route("**/api/v1/audio",route=>route.fulfill({status:503,json:{error:{message:"Audio for this language needs the server speech service. Please read the text for now."}}}));
  await page.goto("/app/plan");await page.evaluate(()=>Object.assign(window.speechSynthesis,{getVoices:()=>[]}));
  const card=page.locator(".instruction-card").first();await card.locator(".card-buttons button").click();
  await expect(card.getByRole("status").last()).toContainText("এই ভাষার অডিওর জন্য সার্ভারের অডিও পরিষেবা দরকার");


 }finally{await db.$disconnect();}
});

test("finale cursor uses the browser compositor and releases to the normal cursor after exit",async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.goto("/");
 await page.locator(".support-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top,behavior:"instant"}));
 await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","support");
 for(const point of [[300,300],[800,500],[1200,600]]){
  await page.mouse.move(point[0],point[1]);await expect(page.locator("html")).toHaveClass(/matter-cursor-native-finale/);
  expect(await page.locator("#family").evaluate(el=>getComputedStyle(el).cursor)).toContain("data:image/svg+xml");
  await expect(page.locator(".matter-cursor-ring")).toHaveCSS("visibility","hidden");
 }
 await page.locator(".landing-nav .brand").hover();await expect(page.locator("html")).not.toHaveClass(/matter-cursor-native-finale/);
 await page.mouse.move(600,500);await page.locator(".support-stage").evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().bottom,behavior:"instant"}));
 expect(await page.evaluate(()=>{const final=document.querySelector("#care-next")!;return Math.abs(final.getBoundingClientRect().top)<innerHeight;})).toBe(true);
 await expect(page.locator(".closing-stage")).toHaveAttribute("data-transition","outro");await expect(page.locator("html")).not.toHaveClass(/matter-cursor-native-finale/);
});
