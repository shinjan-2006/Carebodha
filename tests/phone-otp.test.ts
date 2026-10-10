import {afterEach,describe,expect,it,vi} from "vitest";
import {checkPhoneOtp,sendPhoneOtp,phoneOtpConfigured} from "../src/lib/phone-otp";
import {smsConfigured} from "../src/lib/sms";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function configure(){vi.stubEnv("PHONE_OTP_PROVIDER","twilio-verify");vi.stubEnv("TWILIO_ACCOUNT_SID",`AC${"a".repeat(32)}`);vi.stubEnv("TWILIO_AUTH_TOKEN","fixture-secret");vi.stubEnv("TWILIO_VERIFY_SERVICE_SID",`VA${"b".repeat(32)}`);vi.stubEnv("SMS_PROVIDER","none");}
describe("Twilio Verify OTP transport",()=>{
 it("separates OTP availability from medicine SMS",()=>{configure();expect(phoneOtpConfigured()).toBe(true);expect(smsConfigured()).toBe(false);});
 it("asks Twilio to generate the code instead of sending a custom trial message",async()=>{configure();const request=vi.fn(async()=>new Response(JSON.stringify({status:"pending"})));vi.stubGlobal("fetch",request);await sendPhoneOtp("+919876543210","123456");const args=request.mock.calls[0] as unknown as [string,RequestInit];expect(args[0]).toContain("/Verifications");const form=new URLSearchParams(args[1].body as URLSearchParams);expect(form.get("Channel")).toBe("sms");expect(form.has("CustomCode")).toBe(false);expect(form.has("Body")).toBe(false);});
 it("accepts only provider-approved codes and rejects expired or reused challenges",async()=>{configure();vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({status:"pending"}))).mockResolvedValueOnce(new Response(JSON.stringify({status:"approved"}))).mockResolvedValueOnce(new Response("",{status:404})));expect(await checkPhoneOtp("+919876543210","123456")).toBe(false);expect(await checkPhoneOtp("+919876543210","123456")).toBe(true);expect(await checkPhoneOtp("+919876543210","123456")).toBe(false);});
 it("rejects malformed numbers and codes before requesting the provider",async()=>{configure();const request=vi.fn();vi.stubGlobal("fetch",request);expect(await checkPhoneOtp("9876543210","123456")).toBe(false);expect(await checkPhoneOtp("+919876543210","abc123")).toBe(false);expect(request).not.toHaveBeenCalled();});
 it("does not expose provider error bodies",async()=>{configure();vi.stubGlobal("fetch",vi.fn(async()=>new Response("fixture private error",{status:403})));await expect(sendPhoneOtp("+919876543210","123456")).rejects.toThrow("could not be completed");});
});
