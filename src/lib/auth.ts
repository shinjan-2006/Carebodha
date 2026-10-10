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
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
  plugins: [username({displayUsername:false,immutableUsername:true,usernameValidator:value=>usernamePattern.test(value),usernameNormalization:normalizeUsername}),phoneNumber({
    otpLength:6,expiresIn:300,allowedAttempts:3,phoneNumberValidator:validPhone,
    sendOTP:async({phoneNumber,code},ctx)=>{try{await sendPhoneOtp(phoneNumber,code);}catch{await ctx?.context.internalAdapter.deleteVerificationByIdentifier(phoneNumber);throw new APIError("SERVICE_UNAVAILABLE",{message:"Phone OTP could not be sent. Trial accounts can only message numbers verified with the SMS provider."});}},
    ...(verifyServiceConfigured()?{verifyOTP:async({phoneNumber,code},ctx)=>{
      if(!ctx)return false;
      const challenge=await ctx.context.internalAdapter.consumeVerificationValue(phoneNumber);
      if(!challenge||challenge.expiresAt<new Date())return false;
      const attempts=Number(challenge.value.split(":")[1]||0);
      if(!Number.isSafeInteger(attempts)||attempts>=3)return false;
      let valid=false;
      try{valid=await checkPhoneOtp(phoneNumber,code);}finally{
        if(!valid&&attempts<2)await ctx.context.internalAdapter.createVerificationValue({identifier:phoneNumber,value:`provider:${attempts+1}`,expiresAt:challenge.expiresAt});
      }
      return valid;
    }}:{}),
    ...(phoneOtpConfigured()?{signUpOnVerification:{getTempEmail:(phone:string)=>`${phone.slice(1)}@phone.carebodha.invalid`,getTempName:()=>"Patient"}}:{}),
    callbackOnVerification:async({user},ctx)=>{
      if(ctx?.headers?.get("x-carebodha-phone-purpose")==="register"&&typeof ctx.body?.name==="string"){
        const name=ctx.body.name.trim();await db.user.update({where:{id:user.id},data:{name}});user.name=name;
      }
    }
  })],
  hooks:{before:createAuthMiddleware(async ctx=>{
    if(!phoneOtpConfigured())return;
    if(ctx.path==="/sign-up/email")throw new APIError("FORBIDDEN",{message:"Create your patient account with phone verification."});
    if(["/sign-in/email","/sign-in/username","/sign-in/phone-number"].includes(ctx.path)){
      const identifier=ctx.body?.email||ctx.body?.username||ctx.body?.phoneNumber;
      const user=typeof identifier==="string"?await db.user.findFirst({where:ctx.path==="/sign-in/email"?{email:identifier.toLowerCase().trim()}:ctx.path==="/sign-in/username"?{username:normalizeUsername(identifier)}:{phoneNumber:identifier}}):null;
      if(user?.role!=="CLINICIAN")throw new APIError("UNAUTHORIZED",{message:"Patient sign-in uses a code sent to your registered phone number."});
    }
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
        const name=ctx.body?.name,chosen=ctx.body?.username;
        if(typeof name!=="string"||!name.trim()||name.length>100||typeof chosen!=="string"||!usernamePattern.test(chosen))throw new APIError("BAD_REQUEST",{message:"Enter your name and a username of 3–30 letters, numbers, or underscores."});
        ctx.body.username=normalizeUsername(chosen);
        if(await db.user.findUnique({where:{username:ctx.body.username}}))throw new APIError("BAD_REQUEST",{message:"Choose a different username."});
      }
      return;
    }
    if(!user||!user.phoneNumberVerified||!["PATIENT","FAMILY"].includes(user.role)||user.dataMode!==mode)throw new APIError("BAD_REQUEST",{message:"Use your registered, verified phone number. New patients must create an account first."});
  })},
  user: { additionalFields: {
    role: { type: "string", defaultValue: "PATIENT", input: false },
    dataMode: { type: "string", defaultValue: mode, input: false }
  } },
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 40,customRules:{"/phone-number/send-otp":{window:60,max:2},"/phone-number/verify":{window:60,max:6}} },
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
