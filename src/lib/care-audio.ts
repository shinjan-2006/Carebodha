import {z} from "zod";
import {languageCodes,languageInfo,type Language} from "./languages";
import {translationAudioNotice} from "./translation-audio";
import {HttpError,approvedInstruction,type Actor} from "./security";

export function approvedAudioText(explanations:{language:string;status:string;text:string}[],source:string,language:Language){
 const reviewed=explanations.find(e=>e.language===language&&e.status==="APPROVED"&&e.text.trim());
 return reviewed?.text || (language==="en"?source:translationAudioNotice(language));
}
export async function synthesizeCareAudio(text:string,language:Language){
 if(process.env.TTS_PROVIDER!=="sarvam"||!process.env.SARVAM_API_KEY)throw new HttpError(503,"AUDIO_NOT_CONFIGURED","Audio for this language needs the server speech service. Please read the text for now.");
 if(text.length>2500)throw new HttpError(422,"AUDIO_TEXT_TOO_LONG","This instruction is too long for audio. Read the approved text or ask your care team for a shorter reviewed explanation.");
 let response:Response;
 try{response=await fetch("https://api.sarvam.ai/text-to-speech",{method:"POST",signal:AbortSignal.timeout(25000),headers:{"Content-Type":"application/json","api-subscription-key":process.env.SARVAM_API_KEY},body:JSON.stringify({text,language_code:language==="or"?"od-IN":languageInfo(language).locale,model:"bulbul:v3",speaker:"shubh",pace:.9,output_audio_codec:"wav"})});}
 catch{throw new HttpError(502,"AUDIO_UNAVAILABLE","Audio could not connect. Please try again or read the approved text.");}
 if(!response.ok)throw new HttpError(502,"AUDIO_UNAVAILABLE","Audio is temporarily unavailable. Please try again or read the approved text.");
 const payload=await response.json() as {audios?:unknown};
 if(!Array.isArray(payload.audios)||payload.audios.length!==1||typeof payload.audios[0]!=="string"||payload.audios[0].length>12000000)throw new HttpError(502,"AUDIO_UNAVAILABLE","Audio is temporarily unavailable. Please read the approved text.");
 const audio=Buffer.from(payload.audios[0],"base64");
 if(audio.subarray(0,4).toString()!=="RIFF"||audio.subarray(8,12).toString()!=="WAVE")throw new HttpError(502,"AUDIO_UNAVAILABLE","Audio is temporarily unavailable. Please read the approved text.");
 return audio;
}
export async function careAudio(user:Actor,body:unknown){
 // The client supplies identifiers, never arbitrary text or an unreviewed translation.
 const input=z.object({instructionId:z.string().min(1).max(100),language:z.enum(languageCodes)}).strict().parse(body);
 const instruction=await approvedInstruction(user,input.instructionId);
 const text=approvedAudioText(instruction.explanations,instruction.sourcePassage,input.language);
 return synthesizeCareAudio(text,input.language);
}
