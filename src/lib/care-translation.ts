import {createHash} from "node:crypto";
import {z} from "zod";
import {languageCodes,languageInfo,type Language} from "./languages";
import {approvedInstruction,HttpError,type Actor} from "./security";
import {patientCareText} from "./patient-care-text";

type Instruction=Parameters<typeof patientCareText>[0];
const cache=new Map<string,Promise<string>>();
/** Translate only published text, preserving literal medicine names and quantities. */
export async function translateApprovedText(text:string,language:Language,medicine?:string|null){
 if(language==="en")return text;
 if(!process.env.SARVAM_API_KEY)throw new HttpError(503,"TRANSLATION_UNAVAILABLE","Translation is temporarily unavailable. The approved English instruction remains available.");
 const key=createHash("sha256").update(JSON.stringify([text,language,medicine])).digest("hex");
 const existing=cache.get(key);if(existing)return existing;
 const task=(async()=>{
  const literals:string[]=[];
  const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const pattern=new RegExp(`${medicine?`${escape(medicine)}|`:""}\\b\\d+(?:[.,]\\d+)*(?:\\s*(?:mg|mcg|g|ml|IU|mmHg|mg/dL|%))?`,"gi");
  const protectedText=text.replace(pattern,value=>{const token=`ZXQ${String.fromCharCode(65+literals.length)}QXZ`;literals.push(value);return token;});
  // Provider's limit applies to each request; preserve all paragraphs, never truncate.
  const chunks:string[]=[];let remaining=protectedText;
  while(remaining.length>1800){let end=remaining.lastIndexOf(" ",1800);if(end<1)end=1800;chunks.push(remaining.slice(0,end));remaining=remaining.slice(end);}
  if(remaining)chunks.push(remaining);
  const translated:string[]=[];
  for(const input of chunks){
   let response:Response;
   try{response=await fetch("https://api.sarvam.ai/translate",{method:"POST",signal:AbortSignal.timeout(25000),headers:{"Content-Type":"application/json","api-subscription-key":process.env.SARVAM_API_KEY!},body:JSON.stringify({input,source_language_code:"en-IN",target_language_code:language==="or"?"od-IN":languageInfo(language).locale,model:"sarvam-translate:v1",numerals_format:"international"})});}
   catch{throw new HttpError(502,"TRANSLATION_UNAVAILABLE","Translation is temporarily unavailable. The approved English instruction remains available.");}
   if(!response.ok)throw new HttpError(502,"TRANSLATION_UNAVAILABLE","Translation is temporarily unavailable. The approved English instruction remains available.");
   const payload=await response.json();
   if(typeof payload.translated_text!=="string"||!payload.translated_text.trim())throw new HttpError(502,"TRANSLATION_INVALID","Translation could not be verified. The approved English instruction remains available.");
   translated.push(payload.translated_text.trim());
  }
  let result=translated.join(" ");
  for(const [index,literal] of literals.entries()){
   const token=`ZXQ${String.fromCharCode(65+index)}QXZ`;
   if(result.split(token).length!==2)throw new HttpError(502,"TRANSLATION_INVALID","Translation could not be verified. The approved English instruction remains available.");
   result=result.replace(token,literal);
  }
  // An unexpected new quantity is unsafe even when protected originals survived.
  const numbers=(value:string)=>value.match(/\d+(?:[.,]\d+)*/g)?.sort().join("|")??"";
  if(numbers(result)!==numbers(text))throw new HttpError(502,"TRANSLATION_INVALID","Translation could not be verified. The approved English instruction remains available.");
  return result;
 })();
 if(cache.size>=256)cache.delete(cache.keys().next().value!);
 cache.set(key,task);try{return await task;}catch(error){cache.delete(key);throw error;}
}
export async function translatedCareText(instruction:Instruction,language:Language){
 const original=patientCareText(instruction,language);
 if(!original.fallback)return {...original,machineTranslated:false};
 const text=await translateApprovedText(original.text,language,instruction.medicationName);
 return {text,language,fallback:false,localized:true,machineTranslated:true};
}
export async function careTranslation(user:Actor,body:unknown){
 const input=z.object({instructionId:z.string().min(1).max(100),language:z.enum(languageCodes)}).strict().parse(body);
 // Re-authorize even on a cache hit. Drafts and other patients remain inaccessible.
 return translatedCareText(await approvedInstruction(user,input.instructionId),input.language);
}

