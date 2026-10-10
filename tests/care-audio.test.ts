import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("../src/lib/security",()=>({HttpError:class extends Error{constructor(public status:number,public code:string,message:string){super(message);}},approvedInstruction:vi.fn()}));
import {approvedAudioText,synthesizeCareAudio,careAudio} from "../src/lib/care-audio";
import {approvedInstruction} from "../src/lib/security";
import {languageCodes} from "../src/lib/languages";
import {translateUi} from "../src/lib/ui-translations";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("authorized multilingual audio",()=>{
 it("never speaks an unreviewed translation or English fallback in a selected Indian language",()=>{
  const drafts=[{language:"bn",text:"Unreviewed Bengali",status:"DRAFT"}];
  for(const language of languageCodes.filter(l=>l!=="en")){const text=approvedAudioText(drafts,"English medicine instruction",language);expect(text).not.toContain("English medicine");expect(text).not.toContain("Unreviewed");}
  expect(approvedAudioText([{language:"bn",text:"অনুমোদিত বাংলা",status:"APPROVED"}],"English","bn")).toBe("অনুমোদিত বাংলা");
 });
 it("maps all seven locales, including the provider’s Odia code, and validates WAV audio",async()=>{
  vi.stubEnv("TTS_PROVIDER","sarvam");vi.stubEnv("SARVAM_API_KEY","test-only-key");
  const wav=Buffer.from("RIFF0000WAVE");const fetcher=vi.fn(async(_url:unknown,_options?:RequestInit)=>new Response(JSON.stringify({audios:[wav.toString("base64")]})));vi.stubGlobal("fetch",fetcher);
  for(const language of languageCodes){expect(await synthesizeCareAudio("test fixture",language)).toEqual(wav);expect(JSON.parse(fetcher.mock.calls.at(-1)![1]?.body as string).language_code).toBe(language==="or"?"od-IN":`${language}-IN`);}
 });
 it("requires server credentials without sending text when disabled",async()=>{
  vi.stubEnv("TTS_PROVIDER","none");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);await expect(synthesizeCareAudio("fixture","bn")).rejects.toMatchObject({code:"AUDIO_NOT_CONFIGURED"});expect(fetcher).not.toHaveBeenCalled();
 });
 it("checks published instruction access before generating audio and rejects client-supplied text",async()=>{
  const user={id:"fixture-user"} as Parameters<typeof careAudio>[0];vi.mocked(approvedInstruction).mockRejectedValueOnce(new Error("Forbidden"));const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(careAudio(user,{instructionId:"other-patient",language:"bn"})).rejects.toThrow("Forbidden");expect(fetcher).not.toHaveBeenCalled();
  await expect(careAudio(user,{instructionId:"fixture",language:"bn",text:"unreviewed text"})).rejects.toThrow();
 });
 it("localizes playback progress and configuration errors",()=>{
  for(const language of languageCodes.filter(l=>l!=="en"))for(const text of ["Preparing audio…","Audio for this language needs the server speech service. Please read the text for now."])expect(translateUi(text,language)).not.toBe(text);
 });
});
