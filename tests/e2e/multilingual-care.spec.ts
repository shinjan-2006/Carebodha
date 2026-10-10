import {readFile} from "node:fs/promises";
import {test,expect,request} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
const expectedText={en:"Take 1 tablet twice daily after food.",hi:"लें 1 गोली दिन में दो बार खाने के बाद.",bn:"নিন 1 ট্যাবলেট দিনে দুইবার খাবারের পরে.",or:"ନିଅନ୍ତୁ 1 ଟାବଲେଟ୍ ଦିନକୁ ଦୁଇଥର ଖାଇବା ପରେ.",te:"తీసుకోండి 1 మాత్ర రోజుకు రెండుసార్లు ఆహారం తర్వాత.",pa:"ਲਵੋ 1 ਗੋਲੀ ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ.",ta:"எடுத்துக் கொள்ளுங்கள் 1 மாத்திரை தினமும் இரண்டு முறை உணவுக்குப் பிறகு."};
import {languageCodes,languageInfo} from "../../src/lib/languages";
const answers={en:"I will take 1 tablet twice a day after eating.",hi:"मैं खाने के बाद 1 गोली दिन में दो बार लूँगा।",bn:"আমি খাবারের পরে দিনে দুবার 1 ট্যাবলেট নেব।",or:"ମୁଁ ଖାଇବା ପରେ ଦିନକୁ ଦୁଇଥର 1 ଟାବଲେଟ୍ ନେବି।",te:"నేను ఆహారం తర్వాత రోజుకు రెండుసార్లు 1 మాత్ర తీసుకుంటాను.",pa:"ਮੈਂ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ 1 ਗੋਲੀ ਲਵਾਂਗਾ।",ta:"நான் உணவுக்குப் பிறகு தினமும் இரண்டு முறை 1 மாத்திரை எடுத்துக் கொள்வேன்."};
test("all seven languages: approved plan, Listen, automatic teach-back and source privacy",async({page})=>{
 if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw Error("Use the isolated test database.");
 const db=new PrismaClient(),origin=process.env.BETTER_AUTH_URL!,email=`language-${Date.now()}@example.test`,password="Language-fixture-2026!";
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 try{
  expect((await api.post('/api/auth/sign-up/email',{data:{email,password,name:'Fictional Language Test Patient'}})).status()).toBe(200);
  const workspace=(await (await api.get('/api/v1/workspace')).json()).data;
  const fixture={kind:'MEDICATION',title:'Training medicine',medicationName:'Training medicine',dose:'1',unit:'tablet',frequency:'twice daily',timing:'after food',sourcePassage:'Take 1 tablet twice daily after food.',sourceLocation:'Private PDF page 2',sourceUnclear:false,reviewState:'APPROVED',explanations:{create:[]}};
  const plan=await db.carePlan.create({data:{patientId:workspace.selectedPatientId,title:'Fictional multilingual test',dataMode:'normal',versions:{create:{number:1,status:'APPROVED',approvedAt:new Date(),method:'isolated fixture',instructions:{create:[fixture,{...fixture,title:"Source instruction 1",kind:"CARE",explanations:{create:{language:"en",text:"PRIVATE ORIGINAL SOURCE MUST NOT APPEAR",status:"APPROVED",sourceFields:[],method:"legacy page"}}}]}}}},include:{versions:{include:{instructions:{include:{explanations:true}}}}}});
  const version=plan.versions[0],instruction=version.instructions.find(i=>i.kind==="MEDICATION")!;await db.carePlan.update({where:{id:plan.id},data:{approvedVersionId:version.id}});
  const response=(await (await api.get('/api/v1/workspace')).json()).data;
  expect(response.plans[0].versions[0].instructions).toHaveLength(1); const publicInstruction=response.plans[0].versions[0].instructions[0];expect(publicInstruction.sourcePassage).toBe('');expect(publicInstruction.sourceLocation).toBeNull();expect(JSON.stringify(response)).not.toContain('PRIVATE ORIGINAL SOURCE');
  await page.context().addCookies((await api.storageState()).cookies);
  for(const language of languageCodes){
   await page.goto('/app/plan');await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption(language);await expect(page.locator('.pending-indicator')).toHaveCount(0);
   const text=expectedText[language];await expect(page.locator('.patient-instruction')).toHaveText(text);expect(await page.locator('main').innerText()).not.toContain('PRIVATE ORIGINAL SOURCE');expect(await page.getByText('View original source',{exact:true}).count()).toBe(0);
   await page.evaluate(()=>{Object.assign(window,{SpeechSynthesisUtterance:class{lang='';voice=null;rate=1;constructor(public text:string){}}});Object.assign(window.speechSynthesis,{cancel(){},resume(){},getVoices(){return ['en','hi','bn','or','te','pa','ta'].map(l=>({lang:`${l}-IN`,name:l}));},speak(u:{text:string;lang:string;onstart:()=>void}){Object.assign(window,{__spoken:{text:u.text,lang:u.lang}});u.onstart?.();}});});
   await page.locator('.instruction-card .card-buttons button').first().click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {__spoken:{text:string;lang:string}}).__spoken)).toEqual({text,lang:languageInfo(language).locale});
   await page.goto(`/app/teachback?instructionId=${instruction.id}`);await expect(page.getByText(text,{exact:true})).toBeVisible();await page.locator('#teachback-answer').fill(answers[language]);await page.locator('form').filter({has:page.locator('#teachback-answer')}).locator('button.primary').last().click();await expect(page.locator('.result-panel > .status.green')).toBeVisible();await expect(page.locator('.result-panel')).not.toContainText('MISMATCH');await expect(page.locator('.result-panel .finding')).toHaveCount(4);
   const attempts=(await (await api.get('/api/v1/workspace')).json()).data.attempts;expect(attempts[0].status).toBe('MATCH');expect(attempts[0].method).toBe('source-grounded automatic comparison');
   await page.screenshot({path:`.local-browser-media/verified-teachback-${language}.png`,fullPage:true});
  }
  for(const language of ["bn","or","te","pa"]){
   await page.goto(`/app/teachback?instructionId=${instruction.id}`);await page.getByRole("combobox",{name:"Language / भाषा"}).selectOption(language);
   await page.route("**/api/v1/audio",async route=>{expect(route.request().postDataJSON().language).toBe(language);await new Promise(resolve=>setTimeout(resolve,1500));await route.fulfill({contentType:"audio/wav",body:await readFile(`.local-browser-media/language-audio-${language}.wav`)});});
   await page.evaluate(()=>{Object.assign(window,{SpeechSynthesisUtterance:class{constructor(public text:string){}}});Object.assign(window.speechSynthesis,{resume(){},cancel(){},getVoices(){return ["bn","or","te","pa"].map(l=>({lang:`${l}-IN`,name:l}));},speak(u:{onerror:()=>void}){u.onerror?.();}});});
   for(let replay=0;replay<2;replay++){await page.locator(".approved-passage button").click();await expect(page.locator(".approved-passage button")).toBeDisabled();await expect(page.locator(".voice-toolbar ~ [role=status]")).toContainText(/অডিও শুরু|ଅଡିଓ ଆରମ୍ଭ|ఆడియో ప్రారంభ|ਆਡੀਓ ਸ਼ੁਰੂ/);}
   await page.unroute("**/api/v1/audio");
  }
 }finally{await api.dispose();await db.$disconnect();}
});


test("every card translates and requests selected-language audio, including follow-ups and advice",async({page})=>{
 if(new URL(process.env.DATABASE_URL!).pathname!=="/carebodha_normal_test")throw Error("Use the isolated test database.");
 const db=new PrismaClient(),origin=process.env.BETTER_AUTH_URL!;
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 try{
  expect((await api.post('/api/auth/sign-up/email',{data:{email:`cards-${Date.now()}@example.test`,password:'Card-fixture-2026!',name:'Fictional Card Test'}})).status()).toBe(200);
  const workspace=(await(await api.get('/api/v1/workspace')).json()).data;
  const fixtures=[{kind:'MEDICATION',title:'Second medicine',medicationName:'Fictional Medicine 10 mg',sourcePassage:'Fictional Medicine 10 mg: take 1 tablet before breakfast. Do not double the dose.'},{kind:'FOLLOW_UP',title:'Follow-up review',medicationName:null,sourcePassage:'Return in 3 months with fresh reports.'},{kind:'CARE',title:'Walking advice',medicationName:null,sourcePassage:'Walk for 30 minutes and stop if dizzy.'}];
  const plan=await db.carePlan.create({data:{patientId:workspace.selectedPatientId,title:'Fictional card test',dataMode:'normal',versions:{create:{number:1,status:'APPROVED',approvedAt:new Date(),method:'isolated fixture',instructions:{create:fixtures.map(f=>({...f,sourceUnclear:false,reviewState:'APPROVED'}))}}}},include:{versions:{include:{instructions:true}}}});
  const version=plan.versions[0];await db.carePlan.update({where:{id:plan.id},data:{approvedVersionId:version.id}});
  await page.context().addCookies((await api.storageState()).cookies);
  const translations:Record<string,string>={hi:'अनुवादित निर्देश',bn:'অনুবাদিত নির্দেশ',or:'ଅନୁବାଦିତ ନିର୍ଦ୍ଦେଶ',te:'అనువదించిన సూచన',pa:'ਅਨੁਵਾਦਿਤ ਹਦਾਇਤ',ta:'மொழிபெயர்க்கப்பட்ட வழிமுறை'};
  let active='bn';const plays:string[]=[];
  await page.route('**/api/v1/translation',async route=>{const input=route.request().postDataJSON();expect(translations[input.language]).toBeTruthy();await route.fulfill({json:{data:{text:translations[input.language],language:input.language,fallback:false,localized:true,machineTranslated:true}}});});
  await page.route('**/api/v1/audio',async route=>{const input=route.request().postDataJSON();expect(input.language).toBe(active);plays.push(input.instructionId);await route.fulfill({contentType:'audio/wav',body:await readFile('.local-browser-media/language-audio-bn.wav')});});
  for(const language of Object.keys(translations)){
   active=language;await page.goto('/app/plan');await page.getByRole('combobox',{name:'Language / भाषा'}).selectOption(language);
   for(const instruction of version.instructions){const card=page.locator('.instruction-card').filter({has:page.getByRole('heading',{name:instruction.title,exact:true})});const before=plays.length;await card.locator('.card-buttons button').click();await expect.poll(()=>plays.length).toBe(before+1);expect(plays.at(-1)).toBe(instruction.id);await expect(card.locator('.card-buttons button')).toBeEnabled();await expect(card.locator('.patient-instruction')).toHaveText(translations[language]);}
   for(const instruction of version.instructions){await page.goto(`/app/teachback?instructionId=${instruction.id}`);await expect(page.locator('.approved-passage p')).toHaveText(translations[language]);await page.evaluate(()=>{Object.assign(window.speechSynthesis,{getVoices(){return [];},cancel(){},resume(){}});});const before=plays.length;await page.locator('.approved-passage button').click();await expect.poll(()=>plays.length).toBe(before+1);await expect(page.locator('.approved-passage button')).toBeEnabled();}
  }
 }finally{await api.dispose();await db.$disconnect();}
});

