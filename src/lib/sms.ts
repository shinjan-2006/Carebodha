export const validPhone=(value:string)=>/^\+[1-9]\d{7,14}$/.test(value);
export function smsConfigured(){return process.env.SMS_PROVIDER==="twilio" && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_MESSAGING_SERVICE_SID;}
/** Never log credentials, phone numbers, OTPs, or provider response bodies. */
export async function sendSms(to:string,body:string){
 if(!smsConfigured())throw new Error("Phone messaging is not configured yet. Use your CareBodha password to sign in.");
 if(!validPhone(to)||body.length>1200)throw new Error("Invalid SMS request.");
 const sid=process.env.TWILIO_ACCOUNT_SID!;
 if(!/^AC[a-f0-9]{32}$/i.test(sid))throw new Error("Phone messaging configuration is invalid.");
 const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({To:to,Body:body,MessagingServiceSid:process.env.TWILIO_MESSAGING_SERVICE_SID!,ValidityPeriod:"300"})});
 if(!response.ok)throw new Error("The SMS service could not send the message. Please try again later.");
 const result=await response.json() as {sid?:string};if(!result.sid)throw new Error("The SMS service returned an invalid response.");return result.sid;
}
