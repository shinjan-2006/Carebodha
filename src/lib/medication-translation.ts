import type {ExtractedInstruction} from "./contracts";
import type {Language} from "./languages";

type Translation=Record<Exclude<Language,"en">,string>;
// A deliberately bounded phrase vocabulary. Unknown source text needs a clinician;
// never silently omit it or invent a translated clinical value.
const phrases:Array<[string,Translation]>=[
 ["twice daily",{hi:"दिन में दो बार",bn:"দিনে দুইবার",or:"ଦିନକୁ ଦୁଇଥର",te:"రోజుకు రెండుసార్లు",pa:"ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ",ta:"தினமும் இரண்டு முறை"}],
 ["once daily",{hi:"दिन में एक बार",bn:"দিনে একবার",or:"ଦିନକୁ ଥରେ",te:"రోజుకు ఒకసారి",pa:"ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ",ta:"தினமும் ஒரு முறை"}],
 ["three times daily",{hi:"दिन में तीन बार",bn:"দিনে তিনবার",or:"ଦିନକୁ ତିନିଥର",te:"రోజుకు మూడుసార్లు",pa:"ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ",ta:"தினமும் மூன்று முறை"}],
 ["after food",{hi:"खाने के बाद",bn:"খাবারের পরে",or:"ଖାଇବା ପରେ",te:"ఆహారం తర్వాత",pa:"ਖਾਣੇ ਤੋਂ ਬਾਅਦ",ta:"உணவுக்குப் பிறகு"}],
 ["before food",{hi:"खाने से पहले",bn:"খাবারের আগে",or:"ଖାଇବା ପୂର୍ବରୁ",te:"ఆహారం ముందు",pa:"ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ",ta:"உணவுக்கு முன்பு"}],
 ["with food",{hi:"खाने के साथ",bn:"খাবারের সঙ্গে",or:"ଖାଦ୍ୟ ସହିତ",te:"ఆహారంతో",pa:"ਖਾਣੇ ਨਾਲ",ta:"உணவுடன்"}],
 ["at bedtime",{hi:"सोते समय",bn:"শোবার সময়",or:"ଶୋଇବା ସମୟରେ",te:"నిద్రపోయే సమయంలో",pa:"ਸੌਣ ਵੇਲੇ",ta:"படுக்கைக்குச் செல்லும் நேரத்தில்"}],
 ["by mouth",{hi:"मुँह से",bn:"মুখ দিয়ে",or:"ମୁହଁ ଦ୍ୱାରା",te:"నోటి ద్వారా",pa:"ਮੂੰਹ ਰਾਹੀਂ",ta:"வாய் வழியாக"}],
 ["take",{hi:"लें",bn:"নিন",or:"ନିଅନ୍ତୁ",te:"తీసుకోండి",pa:"ਲਵੋ",ta:"எடுத்துக் கொள்ளுங்கள்"}],
 ["one",{hi:"एक",bn:"এক",or:"ଏକ",te:"ఒక",pa:"ਇੱਕ",ta:"ஒரு"}],
 ["two",{hi:"दो",bn:"দুই",or:"ଦୁଇ",te:"రెండు",pa:"ਦੋ",ta:"இரண்டு"}],
 ["tablets?",{hi:"गोली",bn:"ট্যাবলেট",or:"ଟାବଲେଟ୍",te:"మాత్ర",pa:"ਗੋਲੀ",ta:"மாத்திரை"}],
 ["capsules?",{hi:"कैप्सूल",bn:"ক্যাপসুল",or:"କ୍ୟାପସୁଲ୍",te:"క్యాప్సూల్",pa:"ਕੈਪਸੂਲ",ta:"காப்ஸ்யூல்"}],
 ["of",{hi:"की",bn:"এর",or:"ର",te:"యొక్క",pa:"ਦੀ",ta:"இன்"}]
];
const review:Translation={hi:"के बाद समीक्षा",bn:"পরে পর্যালোচনা",or:"ପରେ ସମୀକ୍ଷା",te:"తర్వాత సమీక్ష",pa:"ਬਾਅਦ ਸਮੀਖਿਆ",ta:"பிறகு மதிப்பாய்வு"};
const duration:Translation={hi:"के लिए",bn:"জন্য",or:"ପାଇଁ",te:"పాటు",pa:"ਲਈ",ta:"வரை"};
const timeUnits:Record<string,Translation>={
 days:{hi:"दिन",bn:"দিন",or:"ଦିନ",te:"రోజులు",pa:"ਦਿਨ",ta:"நாட்கள்"},
 weeks:{hi:"सप्ताह",bn:"সপ্তাহ",or:"ସପ୍ତାହ",te:"వారాలు",pa:"ਹਫ਼ਤੇ",ta:"வாரங்கள்"},
 months:{hi:"महीने",bn:"মাস",or:"ମାସ",te:"నెలలు",pa:"ਮਹੀਨੇ",ta:"மாதங்கள்"}
};
export function localizeClinicalValue(value:string,language:Language){
 if(language==="en")return value;
 for(const [phrase,translations] of phrases)if(new RegExp(`^${phrase}$`,"i").test(value.trim()))return translations[language];
 if(/^oral$/i.test(value.trim()))return phrases.find(([phrase])=>phrase==="by mouth")![1][language];
 const period=/^(?:for\s+)?(\d+)\s+(days?|weeks?|months?)$/i.exec(value.trim());
 if(period)return `${period[1]} ${timeUnits[period[2].toLowerCase().replace(/s?$/,"s")][language]}`;
 return value;
}
export const approvedValueAliases:Record<string,string[]>=Object.fromEntries(phrases.map(([phrase,translations])=>[phrase.replace("s?",""),Object.values(translations)]));
approvedValueAliases.oral=approvedValueAliases["by mouth"];
export function medicationTranslationDraft(i:ExtractedInstruction,language:Language):string{
 if(language==="en")return i.sourcePassage;
 if(i.kind!=="MEDICATION"||i.sourceUnclear||!i.medicationName)return "";
 const replacements:string[]=[];
 const token=(text:string)=>{replacements.push(text);return `\uE000${replacements.length-1}\uE001`;};
 const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 let source=i.sourcePassage.replace(new RegExp(escape(i.medicationName),"gi"),()=>token(i.medicationName!));
 source=source.replace(/\b(review in|for)\s+(\d+)\s+(days?|weeks?|months?)\b/gi,(_,action:string,n:string,unit:string)=>token(`${n} ${timeUnits[unit.toLowerCase().replace(/s?$/,"s")][language]} ${action.toLowerCase()==="for"?duration[language]:review[language]}`));
 for(const [phrase,translations] of phrases)source=source.replace(new RegExp(`\\b${phrase}\\b`,"gi"),()=>token(translations[language]));
 // Strengths and literal numbers survive exactly; every other word must be covered.
 const unknown=source.replace(/\uE000\d+\uE001/g,"").replace(/\b(mg|mcg|g|ml)\b/gi,"").replace(/[\d\s.,;:()\-\/]/g,"");
 if(unknown)return "";
 return source.replace(/\uE000(\d+)\uE001/g,(_,n:string)=>replacements[Number(n)]);
}
