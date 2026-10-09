"use client";
import {createContext,useContext,useEffect,useState,useCallback} from "react";
import {Languages} from "lucide-react";
import {isLanguage,languages,uiText,type Language,type TextKey} from "@/lib/languages";
const LanguageContext=createContext<{language:Language;setLanguage:(language:Language)=>void;t:(key:TextKey)=>string}>({language:"en",setLanguage:()=>{},t:key=>uiText.en[key]});
export function LanguageProvider({children}:{children:React.ReactNode}) {
 const [language,update]=useState<Language>("en");
 useEffect(()=>{try{const saved=localStorage.getItem("carebodha-language-v1");if(isLanguage(saved))update(saved);}catch{}},[]);
 const setLanguage=useCallback((value:Language)=>{document.documentElement.lang=value;update(value);try{localStorage.setItem("carebodha-language-v1",value);}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 return <LanguageContext.Provider value={{language,setLanguage,t:key=>uiText[language][key]}}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
export function LanguageSwitch({value,onChange,disabled=false}:{value?:string;onChange?:(language:Language)=>void;disabled?:boolean}) {
 const {language,setLanguage,t}=useLanguage();
 return <label className="language-switch"><Languages size={17}/><span>{t("language")}</span><select aria-label="Language / भाषा" value={value || language} disabled={disabled} onChange={e=>{if(isLanguage(e.target.value)){setLanguage(e.target.value);onChange?.(e.target.value);}}}>{languages.map(l=><option value={l.code} key={l.code}>{l.code==="en"?l.name:`${l.native} — ${l.name}`}</option>)}</select></label>;
}
