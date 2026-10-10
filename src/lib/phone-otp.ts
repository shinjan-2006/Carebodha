import {sendSms,smsConfigured,validPhone} from "./sms";

export function verifyServiceConfigured(){
 return process.env.PHONE_OTP_PROVIDER==="twilio-verify" && /^AC[a-f0-9]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID||"") && !!process.env.TWILIO_AUTH_TOKEN && /^VA[a-f0-9]{32}$/i.test(process.env.TWILIO_VERIFY_SERVICE_SID||"");
}
export function phoneOtpConfigured(){return verifyServiceConfigured()||smsConfigured();}
async function verifyRequest(endpoint:"Verifications"|"VerificationCheck",fields:Record<string,string>){
 if(!verifyServiceConfigured())throw new Error("Phone verification is not configured.");
 const response=await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/${endpoint}`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields)});
 // Twilio deletes expired, completed and exhausted challenges. Never expose its error body.
 if(endpoint==="VerificationCheck"&&response.status===404)return {status:"expired"};
 if(!response.ok)throw new Error("Phone verification could not be completed. Check that this number is enabled for your SMS service and try again later.");
 return await response.json() as {status?:string};
}
export async function sendPhoneOtp(phone:string,code:string){
 if(!validPhone(phone))throw new Error("Use a phone number with its country code.");
 if(verifyServiceConfigured()){
  const result=await verifyRequest("Verifications",{To:phone,Channel:"sms"});
  if(result.status!=="pending")throw new Error("The verification service did not accept this request.");
 }else await sendSms(phone,`CareBodha: your sign-in code is ${code}. It expires in 5 minutes. Never share this code.`);
}
export async function checkPhoneOtp(phone:string,code:string){
 if(!validPhone(phone)||!/^\d{6}$/.test(code))return false;
 return (await verifyRequest("VerificationCheck",{To:phone,Code:code})).status==="approved";
}
