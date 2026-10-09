import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {extractSourceFields,isUntouchedLegacyExtraction} from "../src/lib/source-extraction";
describe("literal prescription extraction",()=>{
 it("extracts the exact unlabelled prescription in the reported screenshot",()=>{
  const [medication,followup]=extractSourceFields("Metformin 500 mg  1 tablet twice daily  review in 3 months");
  expect(medication).toMatchObject({kind:"MEDICATION",medicationName:"Metformin 500 mg",dose:"1",unit:"tablet",frequency:"twice daily",route:null,timing:null,duration:null});
  expect(followup).toMatchObject({kind:"FOLLOW_UP",sourcePassage:"review in 3 months",followUpAt:null});
 });
 it("keeps the strength, administration dose and stated duration separate",()=>{
  const [i]=extractSourceFields("Sample XR 250mg 2 capsules oral twice daily after food for 5 days");
  expect(i).toMatchObject({kind:"MEDICATION",medicationName:"Sample XR 250mg",dose:"2",unit:"capsules",route:"oral",frequency:"twice daily",timing:"after food",duration:"5 days"});
  expect(extractSourceFields("Fasting glucose 168 mg/dL")[0].kind).toBe("CARE");
 });
 for(const key of ["asha","ravi","meera"]){
  it(`extracts ${key}'s actual sample source and separates care from medication`,()=>{
   const source=readFileSync(`docs/sample-prescriptions/${key}-prescription.txt`,"utf8");
   const result=extractSourceFields(source);expect(result.map(i=>i.kind)).toEqual(["MEDICATION","CARE","FOLLOW_UP"]);
   expect(result[0]).toMatchObject({dose:"1",unit:"tablet",route:"oral",frequency:key==="ravi"?"twice daily":"once daily",duration:key==="asha"?"7 days":key==="ravi"?"5 days":"3 days",sourceUnclear:false});
   expect(result[0].medicationName).toMatch(/^TRAINING TABLET [ABC]$/);expect(result[0].timing).toBe(key==="ravi"?"after breakfast and after dinner":key==="asha"?"after breakfast":"after dinner");
   expect(result[2].followUpAt).toBe("2026-10-23T04:30:00.000Z");for(const i of result)expect(source).toContain(i.sourcePassage);
  });
 }
 it("extracts labelled fields as a single source-grounded instruction",()=>{
  const [i]=extractSourceFields("Medication name: Sample drug\nDose: 2\nUnit: tablets\nRoute: oral\nFrequency: twice daily\nTiming: after food\nDuration: 5 days");
  expect(i).toMatchObject({kind:"MEDICATION",medicationName:"Sample drug",dose:"2",unit:"tablets",duration:"5 days",sourceUnclear:false});
 });
 it("does not infer a route, duration, abbreviation or relative appointment date",()=>{
  const [i,follow]=extractSourceFields("Take one tablet of Sample drug twice daily after food.\nFollow-up tomorrow.");
  expect(i).toMatchObject({medicationName:"Sample drug",dose:"one",unit:"tablet",route:null,duration:null});expect(follow.followUpAt).toBeNull();
  expect(extractSourceFields("Medication: Sample drug; Frequency: BD")[0]).toMatchObject({frequency:"BD",sourceUnclear:true});
 });
 it("flags conflicting frequencies and quantities instead of choosing a regimen",()=>{
  const [i]=extractSourceFields("Medication: Sample drug; Dose: 1 or 2 tablets; Frequency: once daily; Frequency: twice daily");
  expect(i.frequency).toBeNull();expect(i.sourceUnclear).toBe(true);
 });
 it("preserves unknown and non-English source text without inventing fields",()=>{
  const source="डॉक्टर से संपर्क करें।";const [i]=extractSourceFields(source);expect(i.sourcePassage).toBe(source);expect(i.medicationName).toBeNull();
 });
 it("reads PDF medication rows across wrapped lines without treating lab results as prescriptions",()=>{
  const source="Sample Clinic\nInvestigations\nGlucose 168 mg/dL\nRx - Medications\n# Medicine Dose & Timing Duration Purpose / Note\n1 Tab. Sample SR 500 mg 1 tab twice daily, after breakfast\nand dinner\n3 months Note: take with food.\n2 Cap. Sample vitamin\n60,000 IU\n1 cap once a week with a meal 8 weeks Sample note\nAdvice: Review with your care team.\nHealth Concerns Identified\nNot a treatment instruction.\nSuggested Measures to Follow\n• Bring your care plan\nto the visit.\nNext review: 2 weeks.";
  const result=extractSourceFields(source);expect(result.filter(i=>i.kind==="MEDICATION")).toHaveLength(2);
  expect(result[0]).toMatchObject({medicationName:"Sample SR 500 mg",dose:"1",unit:"tab",frequency:"twice daily",timing:"after breakfast\nand dinner",duration:"3 months",route:null,sourceUnclear:false});
  expect(result[1]).toMatchObject({medicationName:"Sample vitamin\n60,000 IU",dose:"1",unit:"cap",frequency:"once a week",timing:"with a meal",duration:"8 weeks"});
  expect(result.at(-1)).toMatchObject({kind:"FOLLOW_UP",followUpAt:null});expect(result.some(i=>i.sourcePassage.includes("Glucose 168"))).toBe(false);
 });
 it("recovers only untouched legacy drafts, never reviewed, edited or approved plans",()=>{
  const i={...extractSourceFields("Bring your documents.")[0],title:"Source instruction 1",sourceLocation:"Source paragraph 1",reviewState:"DRAFT",explanations:[]};
  const v={status:"DRAFT",method:"clinician entry",instructions:[i]};expect(isUntouchedLegacyExtraction(v)).toBe(true);
  expect(isUntouchedLegacyExtraction({...v,status:"APPROVED"})).toBe(false);
  expect(isUntouchedLegacyExtraction({...v,instructions:[{...i,reviewState:"REVIEWED"}]})).toBe(false);
  expect(isUntouchedLegacyExtraction({...v,instructions:[{...i,dose:"1"}]})).toBe(false);
  expect(isUntouchedLegacyExtraction({...v,method:"source field extraction v1"})).toBe(true);
  expect(isUntouchedLegacyExtraction({...v,method:"source field extraction v1",instructions:[{...i,reviewState:"REVIEWED"}]})).toBe(false);
 });
});
