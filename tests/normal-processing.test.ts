import {describe,it,expect,vi,afterEach} from "vitest";
import {extract,compare,draftExplanation} from "../src/lib/ai";
import {languageCodes} from "../src/lib/languages";
import {instructionSchema} from "../src/lib/contracts";
afterEach(()=>vi.unstubAllEnvs());
function manual(){vi.stubEnv("APP_MODE","normal");vi.stubEnv("AI_PROVIDER","manual");}
describe("normal clinician-led processing",()=>{
 it("accepts arbitrary source paragraphs without fabricating clinical values",async()=>{manual();const source="Bring your discharge document to the appointment.\n\nContact your care team with questions.";const result=await extract(source);expect(result.method).toBe("source field extraction v1");expect(result.instructions.map(i=>i.sourcePassage)).toEqual(source.split("\n\n"));expect(result.instructions.every(i=>i.dose===null && i.frequency===null && i.followUpAt===null)).toBe(true);});
 it("does not label an unreviewed translation as translated text",async()=>{manual();const {instructions}=await extract("Bring your discharge document to the appointment.");for(const language of languageCodes){const draft=await draftExplanation(instructionSchema.parse(instructions[0]),language);expect(draft.text).toBe(language==="en"?instructions[0].sourcePassage:"");}});
 it("records a freeform answer for clinician review without inferring a match",async()=>{manual();const {instructions}=await extract("Bring your discharge document to the appointment.");const i={...instructions[0],id:"normal-test-instruction",versionId:"normal-test-version"};const result=await compare(i,"আমি আমার নথি নিয়ে আসব।");expect(result.findings[0]).toMatchObject({status:"NEEDS_CLINICIAN_REVIEW",supportingQuote:"আমি আমার নথি নিয়ে আসব।",approvedValue:i.sourcePassage});expect(result.method).toBe("care-team review");});
});
