import {describe,it,expect,vi,afterEach} from "vitest";
import {compare} from "../src/lib/ai";
import {deterministicComparison,validateComparison,overallStatus} from "../src/lib/teachback";
import {sourceGrounded,teachBackSchema,instructionSchema} from "../src/lib/contracts";
import {validateFile} from "../src/lib/storage";
const instruction={id:"instruction-fixture",versionId:"version-fixture",medicationName:"Demo Medicine A",dose:"one",unit:"tablet",route:null,frequency:"twice daily",timing:"after food",duration:null,sourceUnclear:false,sourcePassage:"Take one tablet of Demo Medicine A twice daily after food."};
describe("teach-back medical boundaries",()=> {
  it("identifies the exact frequency mismatch with a verifiable quote",()=>{const fs=deterministicComparison(instruction,"I will take one tablet once daily after food.");expect(fs.find(f=>f.fieldName==="frequency")).toMatchObject({status:"MISMATCH",supportingQuote:"once daily",approvedValue:"twice daily"});expect(overallStatus(fs)).toBe("MISMATCH");});
  it("identifies dose mismatch",()=>{expect(deterministicComparison(instruction,"I will take two tablets twice daily after food.").find(f=>f.fieldName==="dose")?.status).toBe("MISMATCH");});
  it("agrees with an explicit paraphrase and numeric dose",()=>{expect(overallStatus(deterministicComparison(instruction,"I will take 1 tablet two times a day after meals."))).toBe("MATCH");});
  it("supports the reviewed Hindi fixture",()=>{expect(overallStatus(deterministicComparison(instruction,"मैं एक गोली दिन में दो बार खाने के बाद लूँगी।"))).toBe("MATCH");});
  it("classifies missing frequency and timing as incomplete",()=>{const fs=deterministicComparison(instruction,"I will take one tablet.");expect(fs.find(f=>f.fieldName==="frequency")?.status).toBe("INCOMPLETE");expect(fs.find(f=>f.fieldName==="timing")?.status).toBe("INCOMPLETE");expect(overallStatus(fs)).toBe("INCOMPLETE");});
  it("classifies uncertain answers as unclear",()=>{expect(overallStatus(deterministicComparison(instruction,"Maybe one tablet, I am not sure."))).toBe("UNCLEAR");});
  it("requires clinician review for unclear sources",()=>{expect(overallStatus(deterministicComparison({...instruction,sourceUnclear:true},"I will take one tablet twice daily after food."))).toBe("NEEDS_CLINICIAN_REVIEW");});
  it("does not match partial numeric values",()=>{const fs=deterministicComparison({...instruction,dose:"10",unit:"mg"},"I will take 100 mg twice daily after food.");expect(fs.find(f=>f.fieldName==="dose")?.status).toBe("MISMATCH");});
  it("detects unit conflicts without converting or prescribing",()=>{expect(deterministicComparison({...instruction,dose:"10",unit:"mg"},"I take 10 g twice daily after food.").find(f=>f.fieldName==="unit")?.status).toBe("MISMATCH");});
  it("requires explicit confirmation for voice transcripts",()=>{expect(teachBackSchema.safeParse({instructionId:"x",transcript:"one tablet",inputMode:"VOICE",transcriptConfirmed:false,personType:"PATIENT"}).success).toBe(false);});
  const answer="one tablet twice daily after food";
  const raw=()=>({findings:deterministicComparison(instruction,answer).map(({explanation,clarification,...f})=>{void explanation;void clarification;return f;})});
  it("rejects unknown instruction and version identifiers",()=>{const output=raw();output.findings[0].instructionId="other";expect(()=>validateComparison(output,instruction,answer)).toThrow("INVALID_AI_REFERENCE");});
  it("rejects unverifiable quotes",()=>{const output=raw();output.findings[0].supportingQuote="invented";expect(()=>validateComparison(output,instruction,answer)).toThrow("INVALID_AI_EVIDENCE");});
  it("rejects invented instructions and extra output fields",()=>{const output={...raw(),advice:"Stop medication"};expect(()=>validateComparison(output,instruction,answer)).toThrow();});
  it("rejects unsupported approved values and invalid statuses",()=>{const output=raw();output.findings[0].approvedValue="two";expect(()=>validateComparison(output,instruction,answer)).toThrow();expect(()=>validateComparison({findings:[{...raw().findings[0],status:"SAFE"}]},instruction,answer)).toThrow();});
  it("rejects missing or duplicate fields",()=>{expect(()=>validateComparison({findings:raw().findings.slice(1)},instruction,answer)).toThrow("INCOMPLETE_AI_FIELDS");});
});
describe("live adapter validation without network access",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
  function configure(){vi.stubEnv("APP_MODE","normal");vi.stubEnv("AI_PROVIDER","openai-compatible");vi.stubEnv("AI_API_KEY","fictional-unit-test-key");vi.stubEnv("AI_MODEL","fixture-model");vi.stubEnv("AI_BASE_URL","https://fixture.invalid/v1");}
  it("rejects invalid provider IDs rather than fabricating a successful attempt",async()=>{
    configure();const output={findings:deterministicComparison(instruction,"one tablet twice daily after food").map(({explanation,clarification,...f})=>{void explanation;void clarification;return {...f,instructionId:"invented-id"};})};
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}),{status:200}));
    await expect(compare(instruction,"one tablet twice daily after food")).rejects.toMatchObject({code:"INVALID_AI_OUTPUT"});
  });
  it("bounds retries and reports provider failure",async()=>{configure();const mock=vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("Simulated timeout"));await expect(compare(instruction,"one tablet")).rejects.toMatchObject({code:"AI_UNAVAILABLE"});expect(mock).toHaveBeenCalledTimes(2);});
  it("validates a source-grounded non-medication comparison",async()=>{configure();const care={...instruction,medicationName:null,dose:null,unit:null,frequency:null,timing:null,sourcePassage:"Bring your approved plan to the visit."};const answer="I will bring my plan to the visit.";
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({findings:[{instructionId:care.id,planVersionId:care.versionId,fieldName:"sourcePassage",approvedValue:care.sourcePassage,statedValue:answer,supportingQuote:answer,status:"MATCH"}]})}}]}),{status:200}));
    expect((await compare(care,answer)).findings[0].clarification).toBe(care.sourcePassage);
  });
  it("clearly refuses unsupported non-medication demo comparison",async()=>{vi.stubEnv("APP_MODE","demo");vi.stubEnv("AI_PROVIDER","demo");await expect(compare({...instruction,medicationName:null,dose:null,unit:null,frequency:null,timing:null},"I will bring my plan.")).rejects.toMatchObject({code:"DEMO_COMPARISON_UNSUPPORTED"});});
});
describe("source grounding and private file validation",()=> {
  const data=()=>instructionSchema.parse({kind:"MEDICATION",title:"Demo Medicine A",...Object.fromEntries(Object.entries(instruction).filter(([k])=>!["id","versionId"].includes(k))),sourceLocation:"line 1",followUpAt:null});
  it("accepts only values that appear in the original passage",()=>{expect(sourceGrounded(data(),instruction.sourcePassage).dose).toBe("one");expect(()=>sourceGrounded({...data(),dose:"two"},instruction.sourcePassage)).toThrow("UNSUPPORTED_CLINICAL_VALUE");});
  it("rejects fabricated source passages",()=>{expect(()=>sourceGrounded(data(),"A different source.")).toThrow("UNVERIFIABLE_SOURCE");});
  it("does not invent follow-up times from a date alone",()=>{const d={...data(),kind:"FOLLOW_UP" as const,sourcePassage:"Follow-up on 2026-11-12",medicationName:null,dose:null,unit:null,frequency:null,timing:null,followUpAt:"2026-11-12T10:00:00.000Z"};expect(()=>sourceGrounded(d,d.sourcePassage)).toThrow("UNVERIFIABLE_FOLLOW_UP_DATE");});
  it("rejects incorrect signatures and oversize files",()=>{expect(()=>validateFile(Buffer.from("fake pdf"),"application/pdf")).toThrow("FILE_TYPE_INVALID");expect(()=>validateFile(new Uint8Array(11*1024*1024),"image/png")).toThrow("FILE_SIZE_INVALID");});
});
