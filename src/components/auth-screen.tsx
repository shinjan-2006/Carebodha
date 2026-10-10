"use client";
import {UiText,useUi} from "./ui-text";
import {useState,useEffect} from "react";
import {authClient} from "@/lib/auth-client";
import {normalizeUsername,usernamePattern} from "@/lib/usernames";
import {Brand} from "./brand";
import Link from "next/link";
import {ShieldCheck,Users,Stethoscope,Heart,Eye,EyeOff} from "lucide-react";
import {LanguageSwitch,useLanguage} from "./language-provider";
import {PhoneSignin} from "./phone-signin";
export default function AuthScreen({demoPassword,register=false,expert=false}:{demoPassword?:string;register?:boolean;expert?:boolean}) { const ui=useUi();
  const {t,language}=useLanguage();
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [name,setName]=useState("");const [username,setUsername]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [visible,setVisible]=useState(false);const [signInMethod,setSignInMethod]=useState("password");
  useEffect(()=>{const role=new URLSearchParams(window.location.search).get("demo");if(demoPassword && ["patient","clinician","family"].includes(role || "")){setEmail(`${role}@carebodha.demo`);setPassword(demoPassword);}},[demoPassword]);
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try {
      const identifier=email.trim();const chosenUsername=normalizeUsername(username);
      if(register && chosenUsername && !usernamePattern.test(chosenUsername))throw new Error("Choose a username of 3–30 letters, numbers, or underscores.");
      const result=register?await authClient.signUp.email({email:identifier,password,name,...(chosenUsername?{username:chosenUsername}:{})}):identifier.includes("@")?await authClient.signIn.email({email:identifier,password}):await authClient.signIn.username({username:normalizeUsername(identifier),password});
      if(result.error){setError(result.error.status===429?"Too many sign-in attempts. Please wait a moment and try again.":register?"Please check your details. That email or username may already be in use. Passwords require at least 12 characters.":"Please check your email or username and CareBodha password.");return;}
      if(expert){
        const response=await fetch("/api/v1/workspace",{cache:"no-store"});const account=await response.json();
        if(!response.ok || account.data?.user.role!=="CLINICIAN"){await authClient.signOut();throw new Error("This account does not have medical-expert access. Use patient sign-in, or ask your administrator to enable an expert account.");}
      }
      if(register)await fetch("/api/v1/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({language,timezone:"Asia/Kolkata",largeText:false})}).catch(()=>{});
      const token=new URLSearchParams(window.location.search).get("token");window.location.href=expert?"/expert":token?`/invite?token=${encodeURIComponent(token)}`:"/app";
    }catch(e){setError(e instanceof Error?e.message:"Sign-in is unavailable. Please try again.");}finally{setBusy(false);}
  }
  return <main id="main" className="auth-page">
    <div className="auth-brand"><Brand/><LanguageSwitch/></div>
    <div className="auth-story"><div className="eyebrow"><UiText>{expert?"THE MEDICAL EXPERT DESK":"YOUR CARE, MADE CLEAR"}</UiText></div><h1><UiText>{expert?"CARE STARTS HERE.":"YOUR CARE."}</UiText><br/><span><UiText>{expert?"With you.":"Made clear."}</UiText></span></h1><p><UiText>{expert?"Connect with your patients, review their source instructions, and publish care they can understand.":"Understand the instructions your doctor approved, in the language that feels like yours."}</UiText></p><div className={`auth-portrait ${expert?"doctor":"patient"}`} role="img" aria-label={expert?"Illustration of a doctor with a stethoscope":"Illustration of a patient"}/><span><ShieldCheck size={18}/><UiText>{expert?"Reviewed instructions. Connected care.":"Your care plan is the source. You’re in control."}</UiText></span></div>
    <section className="auth-card">
      {!register && <nav className="auth-audience" aria-label={ui("Sign-in options")}><Link href="/signin" aria-current={!expert?"page":undefined}><Heart size={16}/><UiText>{"Patient / family"}</UiText></Link><Link href="/expert/signin" aria-current={expert?"page":undefined}><Stethoscope size={16}/><UiText>{"Medical expert"}</UiText></Link></nav>}
      <span className="eyebrow"><UiText>{expert?"AUTHORIZED CARE TEAM":t("welcome")}</UiText></span><h2><UiText>{expert?"Medical expert sign-in":register?"Create your account":"Good to see you."}</UiText></h2><p><UiText>{expert?"Sign in to connect a patient and assign reviewed care.":register?"Register as a patient. Family access comes through a patient invitation.":"Sign in to understand your next step."}</UiText></p>
      {demoPassword && !register && <div className="demo-accounts"><span className="micro-label"><UiText>{"EXPLORE WITH FICTIONAL ACCOUNTS"}</UiText></span><div>{[{key:"patient",icon:Heart},{key:"clinician",icon:Stethoscope},{key:"family",icon:Users}].filter(d=>!expert || d.key==="clinician").map(d=><button key={d.key} type="button" onClick={()=>{setEmail(`${d.key}@carebodha.demo`);setPassword(demoPassword);}}><d.icon size={18}/><UiText>{d.key}</UiText></button>)}</div><small><UiText>{"Real sign-in, permissions, and persistent records. Fictional demo data only."}</UiText></small></div>}
      {!register&&!expert&&<div className="signin-methods" role="group" aria-label="Sign-in method"><button type="button" aria-pressed={signInMethod==="password"} onClick={()=>setSignInMethod("password")}><UiText>{"CareBodha password"}</UiText></button><button type="button" aria-pressed={signInMethod==="phone"} onClick={()=>setSignInMethod("phone")}><UiText>{"Phone OTP"}</UiText></button></div>}
      {signInMethod==="phone"?<PhoneSignin/>:<><p className="signin-note"><UiText>{"Your email or username and CareBodha password."}</UiText></p><form onSubmit={submit}>
        {register && <><label><UiText>{t("name")}</UiText><input autoComplete="name" required value={name} onChange={e=>setName(e.target.value)}/></label><label><UiText>{"Username (optional)"}</UiText><input aria-label={ui("Username")} autoComplete="username" pattern="[a-zA-Z0-9_]{3,30}" maxLength={30} placeholder={ui("e.g. asha_sharma")} value={username} onChange={e=>setUsername(e.target.value)}/></label><p className="field-help"><UiText>{"3–30 letters, numbers, or underscores. Share this or your email with your medical expert."}</UiText></p></>}
        <label><UiText>{register?t("email"):"Email or username"}</UiText><input placeholder={ui(expert?"doctor@hospital.org or dr_sharma":"you@gmail.com")} type={register?"email":"text"} autoComplete={register?"email":"username"} required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label><UiText>{t("password")}</UiText><div className="password-field"><input type={visible?"text":"password"} aria-label={ui("Password")} minLength={12} maxLength={128} autoComplete={register?"new-password":"current-password"} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={ui(visible?"Hide password":"Show password")} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {error && <div className="alert red" role="alert"><UiText>{error}</UiText></div>}<button className="button primary full" disabled={busy || !email || password.length<12 || (register && !name.trim())}><UiText>{busy?"Please wait…":expert?"Sign in as medical expert":register?t("register"):t("signin")}</UiText></button>
      </form></>}
      {expert?<p className="expert-access-note"><ShieldCheck size={18}/><UiText>{"Medical-expert accounts are enabled by your CareBodha administrator. Patient registration does not grant expert access."}</UiText></p>:<p className="auth-switch"><UiText>{register?"Already have an account?":"New to CareBodha?"}</UiText> <Link href={register?"/signin":"/register"}><UiText>{register?"Sign in":"Create an account"}</UiText></Link></p>}
      {register && <Link className="text-link" href="/expert/signin"><UiText>{"Medical expert sign-in →"}</UiText></Link>}
      <Link className="back-link" href="/"><UiText>{"Back to CareBodha"}</UiText></Link>
    </section>
  </main>;
}
