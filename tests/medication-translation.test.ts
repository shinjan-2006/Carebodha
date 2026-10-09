import {describe,expect,it} from "vitest";
import {extractSourceFields} from "../src/lib/source-extraction";
import {medicationTranslationDraft} from "../src/lib/medication-translation";
import {languages} from "../src/lib/languages";
import {translationAudioNotice} from "../src/lib/translation-audio";

describe("bounded medication translation drafts",()=>{
 it("preserves medicine, strength, dose and follow-up numbers in all seven languages",()=>{
  const i=extractSourceFields("Metformin 500 mg 1 tablet twice daily review in 3 months")[0];
  for(const l of languages){const text=medicationTranslationDraft(i,l.code);expect(text).toContain("Metformin");expect(text).toContain("500 mg");expect(text.match(/\d+/g)).toEqual(["500","1","3"]);if(l.code!=="en"){expect(text).not.toContain("twice daily");expect(text).not.toContain("review in");}}
 });
 it("does not omit unsupported source qualifiers or infer missing instructions",()=>{
  for(const source of ["Metformin 500 mg 1 tablet twice daily unless dizzy","Metformin 500 mg as directed"]){const i=extractSourceFields(source)[0];expect(medicationTranslationDraft(i,"hi")).toBe("");}
 });
 it("does not translate unclear or freeform care sources using a medication template",()=>{
  const i=extractSourceFields("Metformin 500 mg 1 tablet twice daily")[0];expect(medicationTranslationDraft({...i,sourceUnclear:true},"hi")).toBe("");expect(medicationTranslationDraft({...i,kind:"CARE"},"hi")).toBe("");
 });
 it("provides a localized audio notice instead of English medical instructions when translation is missing",()=>{
  for(const l of languages.filter(l=>l.code!=="en")){expect(translationAudioNotice(l.code)).not.toContain("approved translation");expect(translationAudioNotice(l.code)).not.toContain("Metformin");}
 });
});
