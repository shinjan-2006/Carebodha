import { z } from "zod";
export const missingInformation = "This information is not included in your approved care plan. Please ask your care team.";
export const clarificationRequired = "Doctor clarification required.";
export const permissions = ["READ", "TEACH_BACK", "REMINDERS", "CLARIFY"] as const;
export const permissionSchema = z.array(z.enum(permissions)).min(1).refine(p => p.includes("READ"), "Reading permission is required.");
export const clinicalFields = ["medicationName", "dose", "unit", "route", "frequency", "timing", "duration"] as const;
export type ClinicalField = typeof clinicalFields[number];
export const comparisonFields=[...clinicalFields,"sourcePassage"] as const;
export type ComparisonField=typeof comparisonFields[number];
export const instructionSchema = z.object({
  kind: z.enum(["MEDICATION", "FOLLOW_UP", "CARE", "WARNING", "CONTACT"]), title: z.string().min(1).max(200),
  medicationName: z.string().max(200).nullable(), dose: z.string().max(80).nullable(), unit: z.string().max(80).nullable(),
  route: z.string().max(80).nullable(), frequency: z.string().max(200).nullable(), timing: z.string().max(200).nullable(),
  duration: z.string().max(200).nullable(), followUpAt: z.string().datetime().nullable(),
  sourcePassage: z.string().min(1).max(8000), sourceLocation: z.string().max(100).nullable(), sourceUnclear: z.boolean()
}).strict();
export const extractionSchema = z.object({instructions: z.array(instructionSchema).min(1).max(80)}).strict();
export type ExtractedInstruction = z.infer<typeof instructionSchema>;
export const statuses = ["MATCH", "MISMATCH", "INCOMPLETE", "UNCLEAR", "NEEDS_CLINICIAN_REVIEW"] as const;
export type Status = typeof statuses[number];
export const comparisonSchema = z.object({ findings: z.array(z.object({
  instructionId: z.string(), planVersionId: z.string(), fieldName: z.enum(comparisonFields),
  approvedValue: z.string(), statedValue: z.string(), supportingQuote: z.string(), status: z.enum(statuses)
}).strict()).max(7) }).strict();
export type Finding = z.infer<typeof comparisonSchema>["findings"][number] & { explanation: string; clarification: string };
export type InstructionForCheck = { id: string; versionId: string; sourcePassage: string; sourceUnclear: boolean } & Record<ClinicalField, string | null>;
export const teachBackSchema = z.object({ instructionId: z.string(), transcript: z.string().trim().min(2).max(3000),
  inputMode: z.enum(["TEXT", "VOICE"]), transcriptConfirmed: z.boolean(), personType: z.enum(["PATIENT", "CAREGIVER", "ASSISTED_PATIENT"])
}).strict().refine(v => v.inputMode !== "VOICE" || v.transcriptConfirmed, "Confirm your transcript before evaluation.");
export function sourceGrounded(instruction: ExtractedInstruction, text: string) {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g," ").trim();
  if (!norm(text).includes(norm(instruction.sourcePassage))) throw new Error("UNVERIFIABLE_SOURCE");
  for (const key of clinicalFields) {
    const value = instruction[key];
    if (value && !norm(instruction.sourcePassage).includes(norm(value))) throw new Error("UNSUPPORTED_CLINICAL_VALUE");
  }
  if (instruction.followUpAt) {
    const date = new Date(instruction.followUpAt);
    const exactIso=instruction.sourcePassage.includes(instruction.followUpAt) || instruction.sourcePassage.includes(instruction.followUpAt.replace(".000Z","Z"));
    const local=/(\d{4}-\d{2}-\d{2})\s+(?:at\s+)?(\d{2}:\d{2})\s+([A-Za-z_]+\/[A-Za-z_]+|UTC)/.exec(instruction.sourcePassage);
    let verified=false;
    if(local) {
      try { const parts=new Intl.DateTimeFormat("en-CA",{timeZone:local[3],year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);const get=(k:string)=>parts.find(p=>p.type===k)?.value;
        verified=`${get("year")}-${get("month")}-${get("day")}`===local[1] && `${get("hour")}:${get("minute")}`===local[2];
      }catch{}
    }
    if(!exactIso && !verified) throw new Error("UNVERIFIABLE_FOLLOW_UP_DATE");
  }
  return instruction;
}
