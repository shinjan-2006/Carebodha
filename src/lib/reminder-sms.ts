import {db} from "./db";
import {sendSms} from "./sms";
export async function deliverReminderSms(id:string){
 const r=await db.reminder.findUnique({where:{id},include:{instruction:{include:{version:{include:{plan:{include:{patient:{include:{user:true}}}}}}}}}});
 if(!r||!r.smsRequested||r.smsStatus!=="PENDING"||r.status!=="NOTIFIED")return;
 const plan=r.instruction.version.plan,patient=plan.patient;
 if(plan.approvedVersionId!==r.instruction.versionId||!patient.smsReminders||!patient.user.phoneNumberVerified||!patient.user.phoneNumber){await db.reminder.updateMany({where:{id,smsStatus:"PENDING"},data:{smsStatus:"SKIPPED"}});return;}
 // Claim before sending. An ambiguous provider timeout never causes duplicate SMS on worker retry.
 const claimed=await db.reminder.updateMany({where:{id,smsStatus:"PENDING",status:"NOTIFIED"},data:{smsStatus:"SENDING"}});if(!claimed.count)return;
 try{const sid=await sendSms(patient.user.phoneNumber,`CareBodha reminder: ${r.instruction.medicationName||r.instruction.title}. This is the time you selected. Follow your approved care plan: ${process.env.BETTER_AUTH_URL||"https://carebodha.vercel.app"}/app/plan`);await db.reminder.update({where:{id},data:{smsStatus:"SENT",smsProviderId:sid}});}
 catch{await db.reminder.update({where:{id},data:{smsStatus:"FAILED"}});}
}
