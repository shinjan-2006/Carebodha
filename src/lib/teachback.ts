import { clinicalFields, comparisonSchema, clarificationRequired, type Finding, type InstructionForCheck, type Status, type ComparisonField } from "./contracts";
const normalize = (v: string) => v.toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
const phrases: Record<string, string[]> = {
  "one": ["one", "1", "एक"], "tablet": ["tablet", "tablets", "गोली"],
  "twice daily": ["twice daily", "twice a day", "two times a day", "दिन में दो बार"],
  "once daily": ["once daily", "once a day", "one time a day", "दिन में एक बार"],
  "after food": ["after food", "after meals", "after eating", "खाने के बाद"],
  "before food": ["before food", "before meals", "खाने से पहले"]
};
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
    const approved = i[field]!;
    let stated = findPhrase(answer, phrases[normalize(approved)] || [approved]);
    if(field==="medicationName")stated=/Demo\s+Medicine\s+[A-Z]/i.exec(answer)?.[0] || stated;
    if (field === "frequency") stated = findPhrase(answer, [...(phrases["once daily"]), ...(phrases["twice daily"]), "three times a day", "3 times a day", "three times daily"]) || stated;
    const quantity=/(?<![\p{L}\p{N}])(\d+(?:\.\d+)?|one|two|three|half|एक|दो|तीन)\s*(tablets?|capsules?|mg|g|mcg|ml|mL|गोली)(?![\p{L}\p{N}])/iu.exec(answer);
    if (field === "dose") stated = quantity?.[1] || stated;
    if (field === "unit") stated = quantity?.[2] || stated;
    if (field === "timing") stated = findPhrase(answer, [...phrases["after food"], ...phrases["before food"]]) || stated;
    if (!stated) {
      const ambiguous = /\b(maybe|probably|sometimes|unsure|not sure|as needed|whenever)\b|शायद/iu.test(answer);
      return finish(i, field, null, ambiguous ? "UNCLEAR" : "INCOMPLETE");
    }
    const numeric:Record<string,number>={one:1,two:2,three:3,half:.5,"एक":1,"दो":2,"तीन":3};
    const aNumber=numeric[normalize(approved)] ?? Number(approved);const sNumber=numeric[normalize(stated)] ?? Number(stated);
    const equal = field==="dose" && Number.isFinite(aNumber) && Number.isFinite(sNumber) ? aNumber===sNumber
      : field==="unit" ? normalize(approved).replace(/s$/,"")===normalize(stated).replace(/s$/,"") || (phrases[normalize(approved)] || []).some(p=>normalize(p)===normalize(stated!))
      : (phrases[normalize(approved)] || [approved]).some(p => normalize(p) === normalize(stated!));
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
