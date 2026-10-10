import {isInstructionExplanation} from "./approved-text";
/** Older imports stored entire document pages alongside extracted instructions. */
export function isSourcePageInstruction(instruction: { title: string }) {
  return /^Source instruction\s+\d+$/i.test(instruction.title.trim());
}

/** Reading a published instruction is distinct from exposing its uploaded document. */
export function withApprovedReading<T extends {title:string;reviewState:string;sourcePassage:string;explanations:{language:string;status:string;text:string}[]}>(instruction:T) {
  if(instruction.reviewState!=="APPROVED" || isSourcePageInstruction(instruction) || !instruction.sourcePassage.trim() || instruction.explanations.some(e=>e.language==="en"&&e.status==="APPROVED"&&isInstructionExplanation(e.text)))return instruction;
  return {...instruction,explanations:[...instruction.explanations,{language:"en",status:"APPROVED",text:instruction.sourcePassage,method:"reading of clinician-approved instruction",sourceFields:[]}]};
}
