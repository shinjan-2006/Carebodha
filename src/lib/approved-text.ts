import {languageCodes,type Language} from "./languages";
import {translationAudioNotice} from "./translation-audio";

type Explanation={language:string;status:string;text:string};
/** Legacy interface notices are not clinical explanations, even if saved as approved. */
export function isInstructionExplanation(text:string){
 const normalized=text.replace(/\s+/g," ").trim();
 if(!normalized)return false;
 if(languageCodes.some(code=>normalized===translationAudioNotice(code)))return false;
 if(/अनुवाद.{0,50}उपलब्ध नहीं|অনুবাদ.{0,50}(?:পাওয়া যায়নি|পাওয়া যায় না|উপলব্ধ নয়)|ଅନୁବାଦ.{0,50}ଉପଲବ୍ଧ ନାହିଁ|అనువాదం.{0,50}అందుబాటులో లేదు|ਅਨੁਵਾਦ.{0,50}ਉਪਲਬਧ ਨਹੀਂ|மொழிபெயர்ப்பு.{0,50}இல்லை/u.test(normalized))return false;
 return !/(?:translation.{0,80}(?:not (?:yet )?available|unavailable)|ask.{0,50}care team.{0,40}(?:exact |reviewed )?translation)/i.test(normalized);
}
export function selectApprovedText(explanations:Explanation[],source:string,language:string){
 const valid=explanations.filter(e=>e.status==="APPROVED"&&isInstructionExplanation(e.text));
 const selected=valid.find(e=>e.language===language);
 const english=valid.find(e=>e.language==="en");
 return {text:selected?.text.trim()||english?.text.trim()||source,language:(selected?language:"en") as Language,fallback:!selected&&language!=="en"};
}
