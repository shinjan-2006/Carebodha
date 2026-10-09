"use client";
import {useEffect,useRef,useState} from "react";
import {cancelSpeech,voiceErrors,type VoiceRecognition} from "@/lib/speech";
import {languageInfo} from "@/lib/languages";

export function useVoiceInput(language:string,instructionId:string,onTranscript:(text:string)=>void){
 const [recording,setRecording]=useState(false),[status,setStatus]=useState("");
 const recognition=useRef<VoiceRecognition|null>(null);
 function dispose(){const r=recognition.current;recognition.current=null;if(r){r.onstart=r.onend=null;r.onresult=r.onerror=null;try{r.abort();}catch{}}}
 useEffect(()=>{setRecording(false);setStatus("");return dispose;},[language,instructionId]);
 function start(existing:string){
  dispose();
  if(!window.isSecureContext){setStatus("Voice input requires HTTPS or localhost. Open the secure website and try again.");return;}
  const win=window as unknown as {SpeechRecognition?:new()=>VoiceRecognition;webkitSpeechRecognition?:new()=>VoiceRecognition};
  const Constructor=win.SpeechRecognition || win.webkitSpeechRecognition;
  if(!Constructor){setStatus(voiceErrors["service-not-allowed"]);return;}
  cancelSpeech();
  const r=new Constructor();recognition.current=r;
  r.lang=languageInfo(language).locale;r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  let captured="",failed=false;
  r.onstart=()=>{if(recognition.current===r && !failed)setStatus("Listening. Stop when you are finished.");};
  r.onresult=event=>{
   if(recognition.current!==r || failed)return;
   captured=Array.from(event.results,result=>result[0]?.transcript.trim() || "").filter(Boolean).join(" ");
   if(captured)onTranscript([existing.trim(),captured].filter(Boolean).join(" "));
  };
  r.onerror=event=>{
   if(recognition.current!==r || event.error==="aborted")return;
   failed=true;setRecording(false);setStatus(voiceErrors[event.error] || "Recording could not be transcribed. You can type your answer instead.");
  };
  r.onend=()=>{
   if(recognition.current!==r)return;
   recognition.current=null;setRecording(false);
   if(!failed)setStatus(captured?"Review and edit your transcript, then confirm it before checking.":voiceErrors["no-speech"]);
  };
  try{r.start();setRecording(true);setStatus("Waiting for microphone access. Allow it in your browser.");}
  catch{dispose();setRecording(false);setStatus("Voice input could not start. Please type your answer.");}
 }
 function stop(){try{recognition.current?.stop();}catch{dispose();setRecording(false);}}
 function cancel(){dispose();setRecording(false);setStatus("");}
 return {recording,status,start,stop,cancel,setStatus};
}
