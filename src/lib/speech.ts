import {languageInfo} from "./languages";

let speechRequest=0;
let pendingPlayback:{key:string;promise:Promise<boolean|null>}|undefined;
let activeUtterance:SpeechSynthesisUtterance|undefined;
let audioAbort:AbortController|undefined,audioElement:HTMLAudioElement|undefined,audioUrl:string|undefined;
export function cancelSpeech(){speechRequest++;pendingPlayback=undefined;audioAbort?.abort();audioAbort=undefined;audioElement?.pause();audioElement=undefined;if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=undefined;}if(typeof window!=="undefined")window.speechSynthesis?.cancel();}
/** Never substitute an English voice for a different language. */
export function selectSpeechVoice(voices:SpeechSynthesisVoice[],language:string){
 const locale=languageInfo(language).locale.toLowerCase();
 const normalize=(value:string)=>value.toLowerCase().replaceAll("_","-");
 return voices.find(v=>normalize(v.lang)===locale) || voices.find(v=>normalize(v.lang).split("-")[0]===locale.split("-")[0]);
}
export async function speak(text:string,language="en"):Promise<boolean|null>{
 if(typeof window==="undefined" || !window.speechSynthesis)return false;
 cancelSpeech();const request=speechRequest,synth=window.speechSynthesis;
 let available=selectSpeechVoice(synth.getVoices(),language);
 if(!available){
  // Chrome often loads its voice list after the first click.
  available=await new Promise<SpeechSynthesisVoice|undefined>(resolve=>{
   const done=()=>{clearTimeout(timer);synth.removeEventListener("voiceschanged",changed);resolve(selectSpeechVoice(synth.getVoices(),language));};
   const changed=()=>{if(selectSpeechVoice(synth.getVoices(),language))done();};
   const timer=setTimeout(done,1500);synth.addEventListener("voiceschanged",changed);changed();
  });
 }
 if(request!==speechRequest)return null;
 if(!available)return false;
 const utterance=new SpeechSynthesisUtterance(text);utterance.lang=languageInfo(language).locale;utterance.voice=available;utterance.rate=.86;
 // A listed voice can still be unavailable. Only report actual playback start.
 activeUtterance=utterance;
 return await new Promise<boolean|null>(resolve=>{
  let settled=false;
  const done=(played:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(request===speechRequest?played:null);};
  const timer=setTimeout(()=>{if(request===speechRequest)synth.cancel();done(false);},3000);
  utterance.onstart=()=>done(true);
  utterance.onerror=()=>done(false);
  utterance.onend=()=>{if(activeUtterance===utterance)activeUtterance=undefined;done(true);};
  try{synth.resume();synth.speak(utterance);}catch{done(false);}
 });
}

/** Server fallback uses only the authorized, published instruction fetched by its ID. */
export function speakCare(instructionId:string,text:string,language:string):Promise<boolean|null>{
 const key=JSON.stringify([instructionId,text,language]);
 if(pendingPlayback?.key===key)return pendingPlayback.promise;
 const promise=playCare(instructionId,text,language);
 pendingPlayback={key,promise};
 void promise.finally(()=>{if(pendingPlayback?.promise===promise)pendingPlayback=undefined;}).catch(()=>{});
 return promise;
}
async function playCare(instructionId:string,text:string,language:string):Promise<boolean|null>{
 // Initialize the SAME media element during the click, before voice/network awaits.
 const audio=new Audio("data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
 audio.volume=0;
 const ready=audio.play().then(()=>{audio.pause();audio.currentTime=0;audio.volume=1;},()=>{audio.volume=1;});
 const native=await speak(text,language);if(native!==false){await ready;audio.pause();return native;}
 await ready;
 const request=speechRequest;const controller=new AbortController();audioAbort=controller;
 try{
  const response=await fetch("/api/v1/audio",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({instructionId,language})});
  if(request!==speechRequest)return null;
  if(!response.ok){const payload=await response.json();throw new Error(payload.error?.message || "Audio is temporarily unavailable. Please try again or read the approved text.");}
  const blob=await response.blob();if(request!==speechRequest)return null;
  const url=URL.createObjectURL(blob);audio.src=url;audioUrl=url;audioElement=audio;
  audio.onended=()=>{URL.revokeObjectURL(url);if(audioUrl===url)audioUrl=undefined;};
  await audio.play();return request===speechRequest?true:null;
 }catch(error){if(controller.signal.aborted||request!==speechRequest)return null;throw error;}
 finally{if(audioAbort===controller)audioAbort=undefined;}
}

export type RecognitionResult={isFinal:boolean;0:{transcript:string}};
export type VoiceRecognition={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onstart:(()=>void)|null;onresult:((event:{results:ArrayLike<RecognitionResult>;resultIndex:number})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
export const voiceErrors:Record<string,string>={
 "not-allowed":"Allow microphone access in your browser, then try again.",
 "service-not-allowed":"Voice transcription is unavailable in this browser. Type your answer instead.",
 "audio-capture":"No microphone was found. Connect a microphone and try again.",
 network:"The speech service could not connect. Check your connection and try again.",
 "no-speech":"No speech was detected. Check your microphone and try again.",
 "language-not-supported":"Voice input is not supported for this language in your browser. Type your answer instead."
};


