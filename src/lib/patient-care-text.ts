import {isInstructionExplanation} from "./approved-text";
import {medicationTranslationDraft,localizeClinicalValue} from "./medication-translation";
import {isLanguage,type Language} from "./languages";
import {clinicalFields,type ExtractedInstruction} from "./contracts";
import {translateUi} from "./ui-translations";

type CareTextInstruction={kind:string;title:string;sourceUnclear:boolean} & Partial<Pick<ExtractedInstruction,typeof clinicalFields[number]>> & {explanations:{language:string;status:string;text:string}[]};
/** Localize a complete approved explanation with a fixed vocabulary, never an AI draft.
 * Unknown words cause a complete fallback, so no warning or extra instruction is dropped.
 * Original documents and source passages are deliberately not inputs to this patient view. */
export function patientCareText(i:CareTextInstruction,requested:string){
 const language:Language=isLanguage(requested)?requested:"en";
 const approved=i.explanations.filter(e=>e.status==="APPROVED"&&isInstructionExplanation(e.text));
 const selected=approved.find(e=>e.language===language);
 if(selected)return {text:selected.text.trim(),language,fallback:false,localized:false};
 const english=approved.find(e=>e.language==="en")?.text.trim();
 if(english&&language!=="en"&&!i.sourceUnclear&&i.kind==="MEDICATION"&&i.medicationName){
  const localized=medicationTranslationDraft({kind:i.kind,title:i.title,sourcePassage:english,sourceLocation:null,sourceUnclear:false,followUpAt:null,...Object.fromEntries(clinicalFields.map(field=>[field,i[field]??null]))} as ExtractedInstruction,language);
  if(localized)return {text:localized,language,fallback:false,localized:true};
 }
 if(english)return {text:english,language:"en" as Language,fallback:language!=="en",localized:false};
 // Reviewed structured values remain readable even if an old explanation is an interface notice.
 const details=clinicalFields.filter(field=>i[field]).map(field=>`${translateUi(field==="medicationName"?"Medicine":field,language)}: ${field==="medicationName"||field==="dose"?i[field]:localizeClinicalValue(i[field]!,language)}`).join(". ");
 return {text:details||translateUi("Approved explanation unavailable.",language),language,fallback:false,localized:!!details};
}
