import { auth } from "./auth";
import { db, mode } from "./db";
import { createHash } from "node:crypto";
import type { User } from "@prisma/client";
import {authOrigin} from "./auth-origin";
import {isSourcePageInstruction,withApprovedReading} from "./patient-instructions";
export class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export type Actor = User;
export async function actor(headers: Headers): Promise<Actor> {
  const session = await auth.api.getSession({headers});
  if(!session) throw new HttpError(401,"UNAUTHENTICATED","Please sign in.");
  const user = await db.user.findUnique({where:{id:session.user.id}});
  const guard = await db.environmentGuard.findUnique({where:{id:"environment"}});
  if(!user || user.dataMode!==mode || guard?.mode!==mode) throw new HttpError(403,"ENVIRONMENT_MISMATCH","This account is unavailable in this environment.");
  return user;
}
export function requireClinician(user: Actor) { if(user.role!=="CLINICIAN") throw new HttpError(403,"FORBIDDEN","Clinician access required."); }
export async function permit(user: Actor, patientId: string, permission="READ") {
  const patient=await db.patientProfile.findUnique({where:{id:patientId},include:{user:{select:{dataMode:true}}}});
  if(!patient || patient.user.dataMode!==user.dataMode) throw new HttpError(404,"NOT_FOUND","Patient not found.");
  if(user.role==="PATIENT" && patient.userId===user.id) return;
  if(user.role==="CLINICIAN" && await db.clinicianPatientAssignment.findUnique({where:{clinicianId_patientId:{clinicianId:user.id,patientId}}})) return;
  if(user.role==="FAMILY") {
    const grant=await db.familyAccessGrant.findUnique({where:{patientId_familyId:{patientId,familyId:user.id}}});
    if(grant && !grant.revokedAt && grant.permissions.includes(permission)) return;
  }
  throw new HttpError(403,"FORBIDDEN","You do not have permission to access this patient.");
}
export async function approvedInstruction(user: Actor, id: string, permission="READ") {
  const i=await db.careInstruction.findUnique({where:{id},include:{version:{include:{plan:true}},explanations:{where:{status:"APPROVED"}}}});
  if(!i) throw new HttpError(404,"NOT_FOUND","Instruction not found.");
  await permit(user,i.version.plan.patientId,permission);
  if(user.role!=="CLINICIAN" && isSourcePageInstruction(i)) throw new HttpError(404,"NOT_FOUND","Instruction not found.");
  if(i.reviewState!=="APPROVED" || i.version.status!=="APPROVED" || i.version.plan.approvedVersionId!==i.versionId) throw new HttpError(404,"NOT_PUBLISHED","This instruction is not currently published.");
  return withApprovedReading(i);
}
export function sameOrigin(req: Request) {
  const expected=new URL(authOrigin).origin;
  if(req.headers.get("origin")!==expected) throw new HttpError(403,"CSRF_REJECTED","Request origin is not allowed.");
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function limit(user: Actor, action: string) {
  const key=`app:${user.id}:${action}`; const now=Date.now();
  const rows=await db.$queryRaw<{count:number}[]>`INSERT INTO "RateLimit" ("id","key","count","lastRequest") VALUES (${hashToken(key)},${key},1,${now}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."lastRequest" < ${now-60000} THEN 1 ELSE "RateLimit"."count"+1 END, "lastRequest"=CASE WHEN "RateLimit"."lastRequest" < ${now-60000} THEN ${now} ELSE "RateLimit"."lastRequest" END RETURNING "count"`;
  if(rows[0].count>40) throw new HttpError(429,"RATE_LIMITED","Please wait a minute and try again.");
}
