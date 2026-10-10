import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("../src/lib/security",()=>({HttpError:class extends Error{constructor(public status:number,public code:string,message:string){super(message);}},approvedInstruction:vi.fn()}));
import {careTranslation,translatedCareText,translateApprovedText} from "../src/lib/care-translation";
import {approvedInstruction} from "../src/lib/security";
import {languageCodes} from "../src/lib/languages";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
describe("complete approved instruction translations",()=>{
 for(const language of languageCodes.filter(code=>code!=="en"))it(`${language}: translates medicines beyond the first card, follow-ups, and care advice`,async()=>{
  vi.stubEnv("SARVAM_API_KEY","fixture-only");
  const fetcher=vi.fn(async(_url:string,options:RequestInit)=>new Response(JSON.stringify({translated_text:`Translated ${JSON.parse(options.body as string).input}`})));
  vi.stubGlobal("fetch",fetcher);
  for(const [kind,text,medicine] of [["MEDICATION","Fictional Medicine 10 mg: take 1 tablet at night. Do not double the dose.","Fictional Medicine 10 mg"],["FOLLOW_UP","Return in 3 months with fresh reports.",null],["CARE","Walk for 30 minutes, 5 days each week. Stop if dizzy.",null]] as const){
   const reading=await translatedCareText({kind,title:"Fictional instruction",sourceUnclear:false,medicationName:medicine,explanations:[{language:"en",status:"APPROVED",text}]},language);
   expect(reading).toMatchObject({language,fallback:false,machineTranslated:true});
   expect(reading.text).toContain(text);expect(reading.text).not.toContain("ZXQ");
   expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body as string).target_language_code).toBe(language==="or"?"od-IN":`${language}-IN`);
  }
 });
 it("retains clinician-reviewed translations without using a provider",async()=>{
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  expect(await translatedCareText({kind:"CARE",title:"Fixture",sourceUnclear:false,explanations:[{language:"bn",status:"APPROVED",text:"পর্যালোচিত নির্দেশ"}]},"bn")).toMatchObject({text:"পর্যালোচিত নির্দেশ",machineTranslated:false});expect(fetcher).not.toHaveBeenCalled();
 });
 it("rejects changed protected literals and injected quantities, and retries failed requests",async()=>{
  vi.stubEnv("SARVAM_API_KEY","fixture-only");
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({translated_text:"Changed medicine and dose"}))).mockResolvedValueOnce(new Response(JSON.stringify({translated_text:"ZXQAQXZ 99"})));vi.stubGlobal("fetch",fetcher);
  await expect(translateApprovedText("Fixture 75 mg","hi","Fixture 75 mg")).rejects.toMatchObject({code:"TRANSLATION_INVALID"});
  await expect(translateApprovedText("Fixture 75 mg","hi","Fixture 75 mg")).rejects.toMatchObject({code:"TRANSLATION_INVALID"});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it("checks access before translation, rejects supplied text, and does not send drafts",async()=>{
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);const user={id:"fixture-user"} as Parameters<typeof careTranslation>[0];
  vi.mocked(approvedInstruction).mockRejectedValueOnce(new Error("Forbidden"));
  await expect(careTranslation(user,{instructionId:"other-patient",language:"bn"})).rejects.toThrow("Forbidden");
  await expect(careTranslation(user,{instructionId:"fixture",language:"bn",text:"Draft text"})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 });
});

