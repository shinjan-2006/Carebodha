"use client";
import {useEffect,useState} from "react";
import {patientCareText} from "@/lib/patient-care-text";
type Instruction=Parameters<typeof patientCareText>[0]&{id:string};
type Reading=ReturnType<typeof patientCareText>&{machineTranslated?:boolean};
const pending=new Map<string,Promise<Reading>>();
export function useCareTranslation(instruction:Instruction|undefined,language:string,enabled=true){
 const original:Reading=instruction?patientCareText(instruction,language):{text:"",language:"en" as const,fallback:false,localized:false};
 const key=JSON.stringify([instruction?.id,language,original.text]);
 const [result,setResult]=useState<{key:string;reading:Reading}|null>(null);
 const [error,setError]=useState<{key:string;message:string}|null>(null);
 useEffect(()=>{
  if(!enabled||!instruction||!original.fallback)return;
  let active=true;
  let request=pending.get(key);
  if(!request){
   request=fetch("/api/v1/translation",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({instructionId:instruction.id,language})}).then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"Translation is temporarily unavailable.");return payload.data as Reading;});
   if(pending.size>=256)pending.delete(pending.keys().next().value!);
   pending.set(key,request);void request.catch(()=>pending.delete(key));
  }
  void request.then(reading=>{if(active)setResult({key,reading});},failure=>{if(active)setError({key,message:failure instanceof Error?failure.message:"Translation is temporarily unavailable."});});
  return()=>{active=false;};
 },[key,enabled,instruction?.id,language,original.fallback]);
 return {reading:result?.key===key?result.reading:original,error:error?.key===key?error.message:"",loading:enabled&&original.fallback&&result?.key!==key&&error?.key!==key};
}
export const translationLabels:Record<string,string>={en:"Automatic translation of your approved instruction; not separately clinician-reviewed.",hi:"आपके अनुमोदित निर्देश का स्वचालित अनुवाद; चिकित्सक ने अलग से समीक्षा नहीं की है।",bn:"আপনার অনুমোদিত নির্দেশের স্বয়ংক্রিয় অনুবাদ; চিকিৎসক আলাদাভাবে পর্যালোচনা করেননি।",or:"ଆପଣଙ୍କ ଅନୁମୋଦିତ ନିର୍ଦ୍ଦେଶର ସ୍ୱୟଂଚାଳିତ ଅନୁବାଦ; ଡାକ୍ତର ପୃଥକ ସମୀକ୍ଷା କରିନାହାନ୍ତି।",te:"మీ ఆమోదించిన సూచన యొక్క స్వయంచాలక అనువాదం; వైద్యుడు విడిగా సమీక్షించలేదు.",pa:"ਤੁਹਾਡੀ ਮਨਜ਼ੂਰ ਹਦਾਇਤ ਦਾ ਸਵੈਚਲਿਤ ਅਨੁਵਾਦ; ਡਾਕਟਰ ਨੇ ਵੱਖਰੇ ਤੌਰ 'ਤੇ ਸਮੀਖਿਆ ਨਹੀਂ ਕੀਤੀ।",ta:"உங்கள் அங்கீகரிக்கப்பட்ட வழிமுறையின் தானியங்கி மொழிபெயர்ப்பு; மருத்துவர் தனியாக மதிப்பாய்வு செய்யவில்லை."};

