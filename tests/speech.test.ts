import {afterEach,describe,expect,it,vi} from "vitest";
import {cancelSpeech,selectSpeechVoice,speak} from "../src/lib/speech";
import {languages} from "../src/lib/languages";
import {voiceUiKeys} from "../src/lib/voice-ui";
import {translateUi} from "../src/lib/ui-translations";

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
const voice=(lang:string)=>({lang,name:lang,voiceURI:lang,default:false,localService:true} as SpeechSynthesisVoice);
describe("selected-language speech",()=>{
 it("prefers the selected locale and never substitutes English for a missing language",()=>{
  const voices=[voice("en-US"),...languages.map(l=>voice(l.locale))];
  for(const l of languages)expect(selectSpeechVoice(voices,l.code)?.lang).toBe(l.locale);
  expect(selectSpeechVoice([voice("en-US")],"hi")).toBeUndefined();
 });
 it("waits for asynchronously loaded voices before speaking in Hindi",async()=>{
  const events=new EventTarget();let voices:SpeechSynthesisVoice[]=[];
  const synth=Object.assign(events,{getVoices:()=>voices,cancel:vi.fn(),speak:vi.fn()});
  vi.stubGlobal("window",{speechSynthesis:synth});
  vi.stubGlobal("SpeechSynthesisUtterance",class {text:string;constructor(text:string){this.text=text;}});
  const pending=speak("अपना दस्तावेज़ साथ लाएँ।","hi");
  expect(synth.speak).not.toHaveBeenCalled();voices=[voice("hi-IN")];events.dispatchEvent(new Event("voiceschanged"));
  expect(await pending).toBe(true);expect(synth.speak.mock.calls[0][0]).toMatchObject({lang:"hi-IN",voice:voices[0]});
 });
 it("cancels a pending old-language utterance when the language changes",async()=>{
  vi.useFakeTimers();const events=new EventTarget(),synth=Object.assign(events,{getVoices:()=>[],cancel:vi.fn(),speak:vi.fn()});
  vi.stubGlobal("window",{speechSynthesis:synth});const pending=speak("Old text","bn");cancelSpeech();await vi.runAllTimersAsync();
  expect(await pending).toBeNull();expect(synth.speak).not.toHaveBeenCalled();
 });
 it("translates all new voice messages in every interface language",()=>{
  for(const language of languages.filter(l=>l.code!=="en"))for(const key of voiceUiKeys)expect(translateUi(key,language.code)).not.toBe(key);
 });
});
