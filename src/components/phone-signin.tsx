"use client";
import {useState} from "react";
import {UiText} from "./ui-text";
import {useLanguage} from "./language-provider";
import {normalizeUsername} from "@/lib/usernames";
export function PhoneSignin({register=false}:{register?:boolean}){
 const {language}=useLanguage();
 const [phone,setPhone]=useState("+91"),[code,setCode]=useState(""),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [name,setName]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{
   const response=await fetch(`/api/auth/phone-number/${sent?"verify":"send-otp"}`,{method:"POST",headers:{"Content-Type":"application/json","x-carebodha-phone-purpose":register?"register":"login"},body:JSON.stringify({phoneNumber:phone,...(sent?{code,...(register?{name:name.trim(),username:normalizeUsername(username),password}:{})}:{})})});
   const result=await response.json();if(!response.ok)throw new Error(result.message||"Check your number and code, then try again.");
   if(!sent){setSent(true);return;}
   if(register)await fetch("/api/v1/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({language,timezone:"Asia/Kolkata",largeText:false})});
   const token=new URLSearchParams(window.location.search).get("token");window.location.href=token?`/invite?token=${encodeURIComponent(token)}`:"/app";
  }catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}
 }
 return <form onSubmit={submit}>
 <p className="field-help"><UiText>{register?"Verify your mobile number and choose your CareBodha password.":"A sign-in code is sent only to your registered, verified mobile number."}</UiText></p>
 {register&&!sent&&<><label><UiText>{"Full name"}</UiText><input autoComplete="name" required maxLength={100} disabled={sent||busy} value={name} onChange={e=>setName(e.target.value)}/></label><label><UiText>{"Username"}</UiText><input autoComplete="username" required pattern="[a-zA-Z0-9_]{3,30}" maxLength={30} disabled={sent||busy} value={username} onChange={e=>setUsername(e.target.value)}/></label><label><UiText>{"CareBodha password"}</UiText><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><p className="field-help"><UiText>{"Share your username with your medical expert to connect your care plan."}</UiText></p></>}
 <label><UiText>{register?"Phone number with country code":"Registered phone number"}</UiText><input type="tel" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" placeholder="+91 9876543210" required disabled={sent||busy} value={phone} onChange={e=>setPhone(e.target.value.replace(/\s/g,""))}/></label>
 {sent&&<><label><UiText>{"6-digit sign-in code"}</UiText><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label><p className="field-help" role="status"><UiText>{"Code sent. It expires in 5 minutes. Never share it."}</UiText></p></>}
 {error&&<p role="alert" className="alert red"><UiText>{error}</UiText></p>}
 <button className="button primary full" disabled={busy}><UiText>{busy?"Please wait…":sent?(register?"Verify and create account":"Verify and sign in"):"Send verification code"}</UiText></button>
 {sent&&<button type="button" className="text-link" disabled={busy} onClick={()=>{setSent(false);setCode("");setError("");}}><UiText>{"Change number or request a new code"}</UiText></button>}
 </form>;
}
