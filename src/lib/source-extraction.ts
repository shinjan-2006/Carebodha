import {clinicalFields,instructionSchema,sourceGrounded,type ExtractedInstruction} from "./contracts";

export const sourceExtractionMethod="source field extraction v2";
const labels="medication(?: name)?|medicine(?: name)?|drug|dose|unit|route|frequency|timing|duration|follow.?up";
const fieldLine=new RegExp(`^(?:${labels})\\s*:`,"i");
const metadata=/^(?:patient|test doctor|doctor|scenario|diagnosis|prescriber|date|plan|care plan)\s*:|^(?:FICTIONAL (?:TRAINING PRESCRIPTION|DEMO)|NOT FOR REAL PATIENT CARE)/i;

/** Literal, conservative extraction: no medical knowledge, abbreviations expansion,
 * translation, inferred doses or inferred dates. Every output passes sourceGrounded. */
export function extractSourceFields(text:string):ExtractedInstruction[]{
 const passages:{text:string;line:number}[]=[];
 let block:string[]=[],start=1;
 const tableDocument=/^Rx\s*[-–:]\s*Medications\s*$/im.test(text);
 let section: "context"|"medications"|"care"=tableDocument?"context":"care";
 const medicineRow=/^\s*(?:\d+[.)]?\s+)?(?:Tab\.|Cap\.|Tablet\b|Capsule\b)\s+/i;
 const flush=()=>{if(block.length)passages.push({text:block.join("\n"),line:start});block=[];};
 for(const [index,line] of text.split(/\r?\n/).entries()){
  if(!line.trim()){flush();continue;}
  if(tableDocument){
   if(/^Rx\s*[-–:]\s*Medications\s*$/i.test(line.trim())){flush();section="medications";continue;}
   if(/^Health Concerns Identified/i.test(line)){flush();section="context";continue;}
   if(/^Suggested Measures to Follow/i.test(line)){flush();section="care";continue;}
   if(/^Advice:/i.test(line)){flush();section="care";}
   if(section==="context")continue;
   if(/^# Medicine|^DUMMY \/ SAMPLE|^Not a real prescription|^_{3,}|^Dr\.|^Signature \/|^(?:Physical activity and|weight|Self-monitoring and|safety|Screening, follow-up|and lifestyle)$/i.test(line.trim())){flush();continue;}
  }
  if(metadata.test(line.trim())){flush();continue;}
  const continuation=block.length>0&&((fieldLine.test(line.trim())&&fieldLine.test(block[0].trim()))||
   (section==="medications"&&!medicineRow.test(line)&&medicineRow.test(block[0]))||
   (tableDocument&&section==="care"&&!/^(?:\s*•|Diet\s*•|Advice:|Seek urgent care|Next review:)/i.test(line)&&/•|^Advice:|^Seek urgent care|^Next review:/i.test(block[0])));
  if(!continuation)flush();
  if(!block.length)start=index+1;
  block.push(line);
 }
 flush();
 // Unrecognised documents remain available verbatim instead of disappearing.
 if(!passages.length&&text.trim())passages.push({text:text.trim(),line:1});
 if(!passages.length||passages.length>80||passages.some(p=>p.text.length>8000))throw new Error("SOURCE_REQUIRES_SMALLER_SECTIONS");
 return passages.flatMap(({text:sourcePassage,line},n)=>{
  const i:ExtractedInstruction={kind:"CARE",title:`Source instruction ${n+1}`,sourcePassage,sourceLocation:`Text, line ${line}`,medicationName:null,dose:null,unit:null,route:null,frequency:null,timing:null,duration:null,followUpAt:null,sourceUnclear:false};
  const labelled=(label:string)=>{
   const matches=[...sourcePassage.matchAll(new RegExp(`(?:^|[\\n;,])\\s*(?:${label})\\s*:\\s*([^\\n;,]+)`,"gi"))].map(m=>m[1].trim());
   if(new Set(matches.map(v=>v.toLowerCase())).size>1){i.sourceUnclear=true;return null;}
   return matches[0]||null;
  };
  i.medicationName=labelled("medication(?: name)?|medicine(?: name)?|drug");
  for(const field of clinicalFields.filter(f=>f!=="medicationName"))i[field]=labelled(field);
  const followupClause=/\b(?:follow[- ]?up|review|appointment)\s+(?:in|on|at)\s+[^\n]+/i.exec(sourcePassage);
  const medicationText=followupClause&&followupClause.index>0?sourcePassage.slice(0,followupClause.index):sourcePassage;
  // Full words only. PRN/BD/OD and relative dates deliberately require review.
  const quantity=[...sourcePassage.matchAll(/\b(\d+(?:\.\d+)?|one|two|half)\s*(tablets?|tabs?|capsules?|caps?|mg|mcg|ml|drops?|puffs?)\b/gi)].filter(m=>!(medicineRow.test(sourcePassage)&&m.index===sourcePassage.search(/\S/)&&/^\d+\s+(?:Tab\.|Cap\.)/i.test(sourcePassage.trim())));
  const administration=quantity.filter(m=>/^(?:tab|cap|drop|puff)/i.test(m[2]));
  const doses=administration.length?administration:medicineRow.test(sourcePassage)?[]:quantity;
  if(!i.dose&&!i.unit&&doses.length===1){i.dose=doses[0][1];i.unit=doses[0][2];}
  if(doses.length>1&&!i.dose)i.sourceUnclear=true;
  const unique=(pattern:RegExp)=>{
   const durationColumn=medicineRow.test(sourcePassage)?/\b\d+\s+(?:days?|weeks?|months?)\b/i.exec(medicationText):null;
   const fieldSource=durationColumn?medicationText.slice(0,durationColumn.index+durationColumn[0].length):medicationText;
   const matches=[...fieldSource.matchAll(pattern)].map(m=>m[0]);
   if(new Set(matches.map(v=>v.toLowerCase())).size>1){i.sourceUnclear=true;return null;}
   return matches[0]||null;
  };
  i.route??=unique(/\b(?:oral|orally|intravenous|intramuscular|subcutaneous|topical|inhaled)\b/gi);
  i.frequency??=unique(/\b(?:(?:once|twice|three times|four times)\s+(?:daily|a day|a week|weekly)|every\s+\d+\s+hours?)\b/gi);
  i.timing??=unique(/\b(?:(?:\d+\s+min(?:utes)?\s+)?(?:before|after|with)\s+(?:a\s+)?(?:food|meals?|breakfast|lunch|dinner)(?:\s+and\s+(?:(?:before|after|with)\s+)?(?:breakfast|lunch|dinner))?|at bedtime|(?:in the\s+)?morning)\b/gi);
  i.duration??=/\bfor\s+(\d+\s+(?:days?|weeks?|months?))\b/i.exec(medicationText)?.[1]||null;
  if(!i.duration&&medicineRow.test(sourcePassage))i.duration=unique(/\b\d+\s+(?:days?|weeks?|months?)\b/gi);
  if(!i.medicationName){
   const comma=/^(?:\s*(?:SIMULATION ONLY|Medication|Medicine)\s*:\s*)?\s*([^,:\n]+),\s*(?:\d+(?:\.\d+)?|one|two|half)\s+(?:tablets?|capsules?|mg|mcg|ml)\b/i.exec(sourcePassage);
   const take=/\bTake\s+(?:\d+(?:\.\d+)?|one|two|half)\s+(?:tablets?|capsules?)\s+of\s+(.+?)(?=\s+(?:once|twice|three times|four times|every|before|after|with|for)\b|[.,;\n]|$)/i.exec(sourcePassage);
   const tab=medicineRow.test(sourcePassage)?/^(?:\s*\d+[.)]?\s*)?(?:Tab\.|Cap\.|Tablet\b|Capsule\b)\s+([\s\S]+?)(?=(?:,\s*|\s+)(?:\d+(?:\.\d+)?|one|two|half)\s+(?:tabs?|tablets?|caps?|capsules?)\b|;|$)/i.exec(sourcePassage):null;
   // Unlabelled prescription lines: retain the stated strength in the name,
   // while the separate administration quantity remains the dose. Require both
   // a strength and an administration quantity to avoid classifying lab values.
   const bare=/^\s*(?:[•*-]\s*|\d+[.)]\s*)?([A-Za-z][A-Za-z0-9 ()/+-]*?\s+\d+(?:[,.]\d+)?\s*(?:mg|mcg|IU|units?)\b)\s+(?:\d+(?:\.\d+)?|one|two|half)\s+(?:tablets?|tabs?|capsules?|caps?|ml|drops?|puffs?)\b/i.exec(sourcePassage);
   const bareName=bare&&!/^(?:do\b|avoid\b|stop\b|reduce\b|increase\b|do not\b)/i.test(bare[1])?bare[1]:null;
   i.medicationName=(comma?.[1]||take?.[1]||tab?.[1]||bareName)?.trim()||null;
  }
  if(i.medicationName)i.kind="MEDICATION";
  else if(/^(?:\s*SIMULATION ONLY:\s*)?\s*\b(?:Practice\s+)?follow[- ]?up\b|^Next review:|\b(?:appointment|review)\s+(?:in|on|at)\s+\d/i.test(sourcePassage))i.kind="FOLLOW_UP";
  else if(/^(?:\s*Warning\s*:|\s*Seek\s+(?:urgent|emergency))/i.test(sourcePassage))i.kind="WARNING";
  else if(/^\s*(?:Contact|Call)\b/i.test(sourcePassage))i.kind="CONTACT";
  if(i.kind==="FOLLOW_UP"){
   const iso=/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/.exec(sourcePassage)?.[0];
   const local=/(\d{4}-\d{2}-\d{2})\s+(?:at\s+)?(\d{2}:\d{2})\s+([A-Za-z_]+\/[A-Za-z_]+|UTC)/.exec(sourcePassage);
   if(iso){try{i.followUpAt=new Date(iso).toISOString();sourceGrounded(i,text);}catch{i.followUpAt=null;i.sourceUnclear=true;}}
   else if(local){
    try{
     const target=Date.parse(`${local[1]}T${local[2]}:00Z`);let date=target;
     for(let step=0;step<2;step++){
      const parts=new Intl.DateTimeFormat("en-CA",{timeZone:local[3],year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(date));
      const get=(key:string)=>parts.find(p=>p.type===key)?.value;
      date+=target-Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00Z`);
     }
     i.followUpAt=new Date(date).toISOString();
     sourceGrounded(i,text);
    }catch{i.followUpAt=null;i.sourceUnclear=true;}
   }
  }
  if(/\b(?:unclear|illegible|contradictory|either|or instead|if needed|as needed|PRN|BD|OD|TDS)\b|\d+\s+or\s+\d+/i.test(sourcePassage))i.sourceUnclear=true;
  // Non-medication prose never inherits incidental medication-like quantities.
  if(i.kind!=="MEDICATION")for(const field of clinicalFields)i[field]=null;
  i.title=(i.medicationName||sourcePassage.split("\n")[0]).slice(0,200);
  const grounded=sourceGrounded(instructionSchema.parse(i),text);
  if(i.kind==="MEDICATION"&&followupClause&&followupClause.index>0){
   const followup=extractSourceFields(followupClause[0]).map(item=>sourceGrounded({...item,sourceLocation:`Text, line ${line}`},text));
   return [grounded,...followup];
  }
  return [grounded];
 });
}

export function isUntouchedLegacyExtraction(v:{status:string;method:string;instructions:{kind:string;title:string;sourceLocation:string|null;reviewState:string;medicationName:string|null;dose:string|null;unit:string|null;route:string|null;frequency:string|null;timing:string|null;duration:string|null;followUpAt:unknown;explanations:{status:string}[]}[]}){
 const pristine=v.status==="DRAFT"&&v.instructions.length>0&&v.instructions.every(i=>i.reviewState==="DRAFT"&&i.explanations.length===0);
 if(!pristine)return false;
 if(v.method==="source field extraction v1")return true;
 return v.method==="clinician entry"&&v.instructions.every(i=>i.kind==="CARE"&&/^Source instruction \d+$/.test(i.title)&&/^Source paragraph \d+$/.test(i.sourceLocation||"")&&clinicalFields.every(f=>!i[f])&&!i.followUpAt);
}
