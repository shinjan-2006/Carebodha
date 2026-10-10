import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db, mode } from "./db";
import { APIError,createAuthMiddleware,getSessionFromCtx } from "better-auth/api";
import { username,phoneNumber } from "better-auth/plugins";
import {validPhone} from "./sms";
import {sendPhoneOtp,checkPhoneOtp,phoneOtpConfigured,verifyServiceConfigured} from "./phone-otp";
import {usernamePattern,normalizeUsername} from "./usernames";
import {authOrigin} from "./auth-origin";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authOrigin,
  trustedOrigins: [authOrigin],
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true },
  plugins: [username({displayUsername:false,immutableUsername:true,usernameValidator:value=>usernamePattern.test(value),usernameNormalization:normalizeUsername}),phoneNumber({
    sendPasswordResetOTP:async({phoneNumber,code})=>{await sendPhoneOtp(phoneNumber,code);},
    otpLength:6,expiresIn:300,allowedAttempts:3,phoneNumberValidator:validPhone,
    sendOTP:async({phoneNumber,code},ctx)=>{try{await sendPhoneOtp(phoneNumber,code);}catch{await ctx?.context.internalAdapter.deleteVerificationByIdentifier(phoneNumber);throw new APIError("SERVICE_UNAVAILABLE",{message:"Phone OTP could not be sent. Trial accounts can only message numbers verified with the SMS provider."});}},
    ...(verifyServiceConfigured()?{verifyOTP:async({phoneNumber,code},ctx)=>{
      if(!ctx)return false;
      const challenge=await ctx.context.internalAdapter.consumeVerificationValue(ctx.path==="/phone-number/reset-password"?`${phoneNumber}-request-password-reset`:phoneNumber);
      if(!challenge||challenge.expiresAt<new Date())return false;
      const attempts=Number(challenge.value.split(":")[1]||0);
      if(!Number.isSafeInteger(attempts)||attempts>=3)return false;
      let valid=false;
      try{valid=await checkPhoneOtp(phoneNumber,code);}finally{
        if(!valid&&attempts<2)await ctx.context.internalAdapter.createVerificationValue({identifier:ctx.path==="/phone-number/reset-password"?`${phoneNumber}-request-password-reset`:phoneNumber,value:`provider:${attempts+1}`,expiresAt:challenge.expiresAt});
      }
      return valid;
    }}:{}),
    ...(phoneOtpConfigured()?{signUpOnVerification:{getTempEmail:(phone:string)=>`${phone.slice(1)}@phone.carebodha.invalid`,getTempName:()=>"Patient"}}:{}),
    callbackOnVerification:async({user},ctx)=>{
      if(ctx?.headers?.get("x-carebodha-phone-purpose")==="register"&&typeof ctx.body?.name==="string"){
        const password=await ctx.context.password.hash(ctx.body.password); await ctx.context.internalAdapter.createAccount({userId:user.id,providerId:"credential",accountId:user.id,password}); const name=ctx.body.name.trim();await db.user.update({where:{id:user.id},data:{name}});user.name=name;
      }
    }
  })],
  hooks:{before:createAuthMiddleware(async ctx=>{
    if(!phoneOtpConfigured())return;
    if(ctx.path==="/sign-up/email")throw new APIError("FORBIDDEN",{message:"Create your patient account with phone verification."});
    if(["/phone-number/request-password-reset","/phone-number/reset-password"].includes(ctx.path)){ const registered=await db.user.findUnique({where:{phoneNumber:ctx.body.phoneNumber}}); if(!registered?.phoneNumberVerified||registered.dataMode!==mode)throw new APIError("BAD_REQUEST",{message:"Use your registered, verified phone number."}); if(ctx.path==="/phone-number/reset-password"&&verifyServiceConfigured()){ if(typeof ctx.body.newPassword!=="string"||ctx.body.newPassword.length<12||ctx.body.newPassword.length>128)throw new APIError("BAD_REQUEST",{message:"Choose a password of 12–128 characters."}); const identifier=`${ctx.body.phoneNumber}-request-password-reset`; const challenge=await ctx.context.internalAdapter.consumeVerificationValue(identifier); if(!challenge||challenge.expiresAt<new Date())throw new APIError("BAD_REQUEST",{message:"Request a new verification code."}); const attempts=Number(challenge.value.split(":")[1]||0); if(attempts>=3)throw new APIError("BAD_REQUEST",{message:"Request a new verification code."}); let valid=false;try{valid=await checkPhoneOtp(ctx.body.phoneNumber,ctx.body.otp);}finally{if(valid||attempts<2)await ctx.context.internalAdapter.createVerificationValue({identifier,value:valid?challenge.value:`${challenge.value.split(":")[0]}:${attempts+1}`,expiresAt:challenge.expiresAt});} if(!valid)throw new APIError("BAD_REQUEST",{message:"The verification code is invalid."});ctx.body.otp=challenge.value.split(":")[0]; } return; }
    if(ctx.path!=="/phone-number/send-otp"&&ctx.path!=="/phone-number/verify")return;
    const phone=ctx.body?.phoneNumber;
    if(typeof phone!=="string"||!validPhone(phone))throw new APIError("BAD_REQUEST",{message:"Use a phone number with its country code."});
    const user=await db.user.findUnique({where:{phoneNumber:phone}});
    const purpose=ctx.headers?.get("x-carebodha-phone-purpose");
    if(purpose==="update"||ctx.body?.updatePhoneNumber){
      const session=await getSessionFromCtx(ctx);
      if(!session)throw new APIError("UNAUTHORIZED",{message:"Sign in before connecting your phone."});
      if(user&&user.id!==session.user.id)throw new APIError("BAD_REQUEST",{message:"This phone number cannot be connected."});
      if(ctx.path==="/phone-number/verify"&&!ctx.body?.updatePhoneNumber)throw new APIError("BAD_REQUEST",{message:"Confirm your phone in Language & access."});
      return;
    }
    if(purpose==="register"){
      if(user)throw new APIError("BAD_REQUEST",{message:"Use sign-in for an existing phone number."});
      if(ctx.path==="/phone-number/verify"){
        const name=ctx.body?.name,chosen=ctx.body?.username; if(typeof ctx.body?.password!=="string"||ctx.body.password.length<12||ctx.body.password.length>128)throw new APIError("BAD_REQUEST",{message:"Choose a CareBodha password of 12–128 characters."});
        if(typeof name!=="string"||!name.trim()||name.length>100||typeof chosen!=="string"||!usernamePattern.test(chosen))throw new APIError("BAD_REQUEST",{message:"Enter your name and a username of 3–30 letters, numbers, or underscores."});
        ctx.body.username=normalizeUsername(chosen);
        if(await db.user.findUnique({where:{username:ctx.body.username}}))throw new APIError("BAD_REQUEST",{message:"Choose a different username."});
      }
      return;
    }
    throw new APIError("FORBIDDEN",{message:"Use your CareBodha password to sign in. OTP is only for registration or password recovery."});
  })},
  user: { additionalFields: {
    role: { type: "string", defaultValue: "PATIENT", input: false },
    dataMode: { type: "string", defaultValue: mode, input: false }
  } },
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 40,customRules:{"/phone-number/request-password-reset":{window:60,max:2},"/phone-number/reset-password":{window:60,max:6},"/phone-number/send-otp":{window:60,max:2},"/phone-number/verify":{window:60,max:6}} },
  advanced: { useSecureCookies: authOrigin.startsWith("https://") },
  databaseHooks: { user: { create: { before: async user => {
    const guard=await db.environmentGuard.findUnique({where:{id:"environment"}});
    if(guard?.mode!==mode) throw new APIError("FORBIDDEN",{message:"This environment is not configured for registration."});
    return {data:{...user,role:"PATIENT",dataMode:mode}};
  }, after: async user => {
    await db.patientProfile.create({ data: { userId: user.id } });
  } } } },
  logger: { disabled: true }
});
