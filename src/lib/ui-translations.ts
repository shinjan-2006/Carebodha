import catalog from "./ui-catalog.json";
import {uiText,type Language} from "./languages";
import {manualUi} from "./ui-manual";
import {voiceUi} from "./voice-ui";
const translations=Object.fromEntries(Object.entries(catalog).map(([language,rows])=>[language,Object.fromEntries(Object.entries(rows).map(([key,value])=>[key.toLowerCase(),value]))])) as Partial<Record<Language,Record<string,string>>>;
const commonKeys=Object.fromEntries(Object.entries(uiText.en).map(([key,value])=>[value,key])) as Record<string,keyof typeof uiText.en>;
const overrides:Partial<Record<Language,Record<string,string>>>={
 hi:{"UNDERSTAND":"समझें","YOUR CARE":"अपनी देखभाल","with":"पूरी","clarity.":"स्पष्टता से।","CARE SHOULD":"देखभाल हो","FEEL CLEAR.":"स्पष्ट।","READ.":"पढ़ें।","EXPLAIN.":"बताएँ।","CLARIFY.":"समझें।"},
 bn:{"UNDERSTAND":"বুঝুন","YOUR CARE":"আপনার পরিচর্যা","with":"পূর্ণ","clarity.":"স্পষ্টতার সঙ্গে।","CARE SHOULD":"পরিচর্যা হোক","FEEL CLEAR.":"স্পষ্ট।","READ.":"পড়ুন।","EXPLAIN.":"বলুন।","CLARIFY.":"বুঝুন।"},
 or:{"UNDERSTAND":"ବୁଝନ୍ତୁ","YOUR CARE":"ଆପଣଙ୍କ ଯତ୍ନ","with":"ପୂର୍ଣ୍ଣ","clarity.":"ସ୍ପଷ୍ଟତା ସହ।","CARE SHOULD":"ଯତ୍ନ ହେଉ","FEEL CLEAR.":"ସ୍ପଷ୍ଟ।","READ.":"ପଢ଼ନ୍ତୁ।","EXPLAIN.":"କୁହନ୍ତୁ।","CLARIFY.":"ବୁଝନ୍ତୁ।"},
 te:{"UNDERSTAND":"అర్థం చేసుకోండి","YOUR CARE":"మీ సంరక్షణ","with":"పూర్తి","clarity.":"స్పష్టతతో.","CARE SHOULD":"సంరక్షణ ఉండాలి","FEEL CLEAR.":"స్పష్టంగా.","READ.":"చదవండి.","EXPLAIN.":"చెప్పండి.","CLARIFY.":"తెలుసుకోండి."},
 pa:{"UNDERSTAND":"ਸਮਝੋ","YOUR CARE":"ਆਪਣੀ ਦੇਖਭਾਲ","with":"ਪੂਰੀ","clarity.":"ਸਪਸ਼ਟਤਾ ਨਾਲ।","CARE SHOULD":"ਦੇਖਭਾਲ ਹੋਵੇ","FEEL CLEAR.":"ਸਪਸ਼ਟ।","READ.":"ਪੜ੍ਹੋ।","EXPLAIN.":"ਦੱਸੋ।","CLARIFY.":"ਸਮਝੋ।"},
 ta:{"UNDERSTAND":"புரிந்துகொள்ளுங்கள்","YOUR CARE":"உங்கள் பராமரிப்பு","with":"முழு","clarity.":"தெளிவுடன்.","CARE SHOULD":"பராமரிப்பு இருக்கட்டும்","FEEL CLEAR.":"தெளிவாக.","READ.":"படியுங்கள்.","EXPLAIN.":"கூறுங்கள்.","CLARIFY.":"தெளிவுபெறுங்கள்."}
};
/** Exact static-copy lookup: never translate records, names, answers or source text. */
export function translateUi(text:string,language:Language){
 if(language==="en")return text;
 const original=text.replace(/\s+/g," ").trim();
 const aliases:Record<string,string>={MEDICATION:"Medication",CARE:"Care",WARNING:"Warning",CONTACT:"Contact","FOLLOW UP":"Follow-up",READ:"Read"};
 const key=aliases[original] || original;
 const common=commonKeys[key];
 const translated=voiceUi[language]?.[key] || manualUi[language]?.[key] || overrides[language]?.[key] || (common?uiText[language][common]:undefined) || translations[language]?.[key.toLowerCase()];
 if(!translated)return text;
 return `${/^\s/.test(text)?" ":""}${translated}${/\s$/.test(text)?" ":""}`;
}
