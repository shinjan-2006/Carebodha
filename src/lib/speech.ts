import {languageInfo} from "./languages";
export function speak(text:string,language="en") {
  if(typeof window==="undefined" || !window.speechSynthesis) return false;
  speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(text);voice.lang=languageInfo(language).locale;voice.rate=.86;
  const available=speechSynthesis.getVoices().find(v=>v.lang.startsWith(language));if(language!=="en" && !available)return false;if(available)voice.voice=available;
  speechSynthesis.speak(voice);return true;
}
