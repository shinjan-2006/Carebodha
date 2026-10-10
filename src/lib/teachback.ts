import { clinicalFields, comparisonSchema, clarificationRequired, type Finding, type InstructionForCheck, type Status, type ComparisonField } from "./contracts";
import {approvedValueAliases,localizeClinicalValue} from "./medication-translation";
import {languageCodes} from "./languages";
const normalize = (v: string) => v.toLowerCase().replace(/[.,!?]/g, "").replace(/[०-९০-৯୦-୯౦-౯੦-੯௦-௯]/g,c=>String(c.charCodeAt(0)-[0x966,0x9e6,0xb66,0xc66,0xa66,0xbe6].find(n=>c.charCodeAt(0)>=n&&c.charCodeAt(0)<=n+9)!)).replace(/\s+/g, " ").trim();
const phrases: Record<string, string[]> = {
  "one": ["one", "1", "एक","এক","ଏକ","ఒక","ਇੱਕ","ஒரு"], "tablet": ["tablet", "tablets","tab", "गोली","ট্যাবলেট","ଗୋଳି","మాత్ర","ਗੋਲੀ","மாத்திரை"],
  "twice daily": ["twice daily", "twice a day", "two times a day", "दिन में दो बार","দিনে দুইবার","দিনে দুবার","ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ","రోజుకు రెండుసార్లు","ଦିନରେ ଦୁଇଥର","ஒரு நாளைக்கு இரண்டு முறை"],
  "once daily": ["once daily", "once a day", "one time a day", "दिन में एक बार","দিনে একবার","ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ","రోజుకు ఒకసారి","ଦିନରେ ଥରେ","ஒரு நாளைக்கு ஒரு முறை"],
  "after food": ["after food", "after meals", "after eating", "खाने के बाद"],
  "before food": ["before food", "before meals", "खाने से पहले"]
};
for(const [key,values] of Object.entries(approvedValueAliases))phrases[key]=[...(phrases[key]||[key]),...values];
phrases["three times daily"]=["three times daily","three times a day","3 times a day",...approvedValueAliases["three times daily"]];
phrases["oral"]=["oral",...phrases["by mouth"]];
const frequencyKeys=["once daily","twice daily","three times daily"];
function aliasesFor(value:string){
 if(/^(?:for\s+)?\d+\s+(days?|weeks?|months?)$/i.test(value.trim()))return languageCodes.map(language=>localizeClinicalValue(value,language));
 const normalized=normalize(value).replace(/s$/,"");
 const entry=Object.entries(phrases).find(([key,values])=>normalize(key)===normalized||values.some(alias=>normalize(alias).replace(/s$/,"")===normalized));
 return entry?.[1]||[value];
}
function findPhrase(answer: string, candidates: string[]) {
  for (const phrase of candidates) {
    const index = normalize(answer).indexOf(normalize(phrase));
    if (index >= 0) {
      // Use an actual substring of the unmodified transcript as the evidence.
      const literal = new RegExp(`(?<![\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?![\\p{L}\\p{N}])`,"iu").exec(answer);
      if (literal) return literal[0];
    }
  }
  return null;
}
function finish(i: InstructionForCheck, field: ComparisonField, stated: string | null, status: Status, quote = stated || ""): Finding {
  const approved = i[field] || "";
  const explanation = status === "MATCH" ? `Your answer agrees with the approved ${field}. This checks understanding only.`
    : status === "MISMATCH" ? `You said ‘${stated}.’ Your approved instruction says ‘${approved}.’`
    : status === "INCOMPLETE" ? `The ${field} was not stated. Your approved instruction says ‘${approved}.’`
    : status === "NEEDS_CLINICIAN_REVIEW" ? clarificationRequired : `We could not clearly compare the ${field}. Please explain it again or ask your care team.`;
  return {instructionId:i.id, planVersionId:i.versionId, fieldName:field, approvedValue:approved,
    statedValue:stated || "not stated", supportingQuote:quote, status, explanation,
    clarification: i.sourceUnclear ? clarificationRequired : i.sourcePassage};
}
export function deterministicComparison(i: InstructionForCheck, answer: string): Finding[] {
  return checkedFields(i,answer).map(field => {
    if (i.sourceUnclear) return finish(i, field, null, "NEEDS_CLINICIAN_REVIEW");
    if(field==="sourcePassage")return finish(i,field,normalize(answer)===normalize(i.sourcePassage)?answer:null,normalize(answer)===normalize(i.sourcePassage)?"MATCH":"NEEDS_CLINICIAN_REVIEW");
    if(/\b(not|never|skip|stop|don't|won't|cannot)\b|नहीं|নয়|নেই|ନାହିଁ|కాదు|తీసుకోను|ਨਹੀਂ|இல்லை|மாட்டேன்/iu.test(answer))return finish(i,field,null,"UNCLEAR");
    const approved = i[field]!;
    let stated = findPhrase(answer, aliasesFor(approved));
    if(field==="medicationName")stated=/Demo\s+Medicine\s+[A-Z]/i.exec(answer)?.[0] || stated;
    if (field === "frequency") stated = findPhrase(answer,frequencyKeys.flatMap(key=>phrases[key])) || stated;
    if(field==="frequency"&&frequencyKeys.filter(key=>findPhrase(answer,phrases[key])).length>1)return finish(i,field,null,"UNCLEAR");
    const quantities=[...answer.matchAll(/(?<![\p{L}\p{N}])(\d+(?:\.\d+)?|[०-९০-৯୦-୯౦-౯੦-੯௦-௯]+|one|two|three|half|एक|दो|तीन|এক|দুই|ਇੱਕ|ਦੋ|ஒரு|ஒன்று|இரண்டு|ఒక|రెండు|ଏକ|ଦୁଇ)\s*(tablets?|tabs?|capsules?|mg|g|mcg|ml|mL|गोली|टैबलेट|ট্যাবলেট|ଟାବଲେଟ୍|ଗୋଳି|మాత్ర|ਗੋਲੀ|மாத்திரை|कैप्सूल|ক্যাপসুল|କ୍ୟାପସୁଲ୍|క్యాప్సూల్|ਕੈਪਸੂਲ|காப்ஸ்யூல்)(?![\p{L}\p{N}])/giu)];
    const tabletUnit=(v:string)=>(phrases.tablet.some(p=>normalize(p)===normalize(v))||/^tabs?$/i.test(v));
    const quantity=quantities.find(q=>i.unit&&(normalize(q[2]).replace(/s$/,"")===normalize(i.unit).replace(/s$/,"")||tabletUnit(q[2])&&tabletUnit(i.unit)))||quantities[0];
    const sameUnit=quantities.filter(q=>quantity&&(normalize(q[2]).replace(/s$/,"")===normalize(quantity[2]).replace(/s$/,"")||tabletUnit(q[2])&&tabletUnit(quantity[2])));
    if(["dose","unit"].includes(field)&&new Set(sameUnit.map(q=>normalize(q[1]))).size>1)return finish(i,field,null,"UNCLEAR");
    if (field === "dose") stated = quantity?.[1] || stated;
    if (field === "unit") stated = quantity?.[2] || stated;
    const timingKeys=["after food","before food","with food","at bedtime"];
    if (field === "timing") stated = findPhrase(answer,timingKeys.flatMap(key=>phrases[key])) || stated;
    if(field==="timing"&&timingKeys.filter(key=>findPhrase(answer,phrases[key])).length>1)return finish(i,field,null,"UNCLEAR");
    if (!stated) {
      const ambiguous = /\b(maybe|probably|sometimes|unsure|not sure|as needed|whenever)\b|शायद/iu.test(answer);
      return finish(i, field, null, ambiguous ? "UNCLEAR" : "INCOMPLETE");
    }
    const numeric:Record<string,number>={one:1,two:2,three:3,half:.5,"एक":1,"दो":2,"तीन":3,"এক":1,"দুই":2,"ਇੱਕ":1,"ਦੋ":2,"ஒரு":1,"ஒன்று":1,"இரண்டு":2,"ఒక":1,"రెండు":2,"ଏକ":1,"ଦୁଇ":2};
    const aNumber=numeric[normalize(approved)] ?? Number(normalize(approved));const sNumber=numeric[normalize(stated)] ?? Number(normalize(stated));
    const equal = field==="dose" && Number.isFinite(aNumber) && Number.isFinite(sNumber) ? aNumber===sNumber
      : field==="unit" ? normalize(approved).replace(/s$/,"")===normalize(stated).replace(/s$/,"") || aliasesFor(approved).some(p=>normalize(p)===normalize(stated!))
      : aliasesFor(approved).some(p => normalize(p) === normalize(stated!));
    if(equal && /\b(maybe|probably|sometimes|unsure|not sure|whenever)\b|शायद/iu.test(answer)) return finish(i,field,stated,"UNCLEAR");
    return finish(i, field, stated, equal ? "MATCH" : "MISMATCH");
  });
}
export function checkedFields(i: InstructionForCheck, answer: string):ComparisonField[] {
  // The medicine is selected by the question. Check its name when the person explicitly states one.
  const fields=clinicalFields.filter(f=>!!i[f] && (f!=="medicationName" || /medicine|दवा/iu.test(answer)));
  return fields.length?fields:["sourcePassage"];
}
export function validateComparison(raw: unknown, i: InstructionForCheck, answer: string): Finding[] {
  const result = comparisonSchema.parse(raw);
  const expected = checkedFields(i,answer);
  if (result.findings.length !== expected.length || new Set(result.findings.map(f=>f.fieldName)).size !== expected.length) throw new Error("INCOMPLETE_AI_FIELDS");
  return result.findings.map(f => {
    if (f.instructionId !== i.id || f.planVersionId !== i.versionId || !expected.includes(f.fieldName) || f.approvedValue !== i[f.fieldName]) throw new Error("INVALID_AI_REFERENCE");
    if (f.statedValue === "not stated") {
      if (f.supportingQuote !== "" || !["INCOMPLETE", "UNCLEAR", "NEEDS_CLINICIAN_REVIEW"].includes(f.status)) throw new Error("INVALID_AI_EVIDENCE");
    } else if (!f.supportingQuote || !answer.includes(f.supportingQuote) || !f.supportingQuote.includes(f.statedValue)) throw new Error("INVALID_AI_EVIDENCE");
    if (i.sourceUnclear && f.status !== "NEEDS_CLINICIAN_REVIEW") throw new Error("UNCLEAR_SOURCE");
    const deterministic = deterministicComparison(i, answer).find(d=>d.fieldName===f.fieldName)!;
    // Explicit numbers/units and recognized frequencies always take precedence over semantic output.
    if (["dose","unit"].includes(f.fieldName) || (["frequency"].includes(f.fieldName) && deterministic.status === "MISMATCH")) return deterministic;
    return finish(i, f.fieldName, f.statedValue === "not stated" ? null : f.statedValue, f.status, f.supportingQuote);
  });
}
export function overallStatus(findings: Finding[]): Status {
  return (["NEEDS_CLINICIAN_REVIEW","MISMATCH","UNCLEAR","INCOMPLETE","MATCH"] as Status[]).find(s=>findings.some(f=>f.status===s)) || "UNCLEAR";
}
