import {languageInfo} from "./languages";

let speechRequest=0;
export function cancelSpeech(){speechRequest++;if(typeof window!=="undefined")window.speechSynthesis?.cancel();}
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
 synth.speak(utterance);return true;
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
