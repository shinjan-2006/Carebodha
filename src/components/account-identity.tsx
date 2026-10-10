"use client";
import {UiText,useUi} from "./ui-text";
import {useState} from "react";
import {authClient} from "@/lib/auth-client";
import {normalizeUsername,usernamePattern} from "@/lib/usernames";
export function AccountIdentity({user,refresh}:{user:{email:string;username?:string|null};refresh:()=>Promise<void>}) { const ui=useUi();
  const [username,setUsername]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");setSaved(false);const value=normalizeUsername(username);
    if(!usernamePattern.test(value)){setError("Use 3–30 letters, numbers, or underscores.");return;}
    setPending(true);
    try{const result=await authClient.updateUser({username:value});if(result.error)throw new Error(result.error.message || "That username is unavailable. Choose another.");await refresh();setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setPending(false);}
  }
  return <section className="panel account-identity"><span className="micro-label"><UiText>{"YOUR PATIENT IDENTIFIER"}</UiText></span><h2><UiText>{"Connect with your medical expert."}</UiText></h2><p><UiText>{"Share your registered email or username so your expert can assign your care plan."}</UiText></p><dl>{!user.email.endsWith("@phone.carebodha.invalid")&&<><dt><UiText>{"Email address"}</UiText></dt><dd>{user.email}</dd></>}{user.username && <><dt><UiText>{"Username"}</UiText></dt><dd>@{user.username}</dd></>}</dl>{!user.username && <form onSubmit={submit}><label><UiText>{"Choose a username"}</UiText><input aria-label={ui("Choose a username")} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]{3,30}" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><p className="field-help"><UiText>{"Choose once. Use 3–30 letters, numbers, or underscores."}</UiText></p><button className="button secondary" disabled={pending}><UiText>{"Save username"}</UiText></button></form>}{error && <p className="alert red" role="alert"><UiText>{error}</UiText></p>}{saved && <p className="connection-success" role="status"><UiText>{"Username saved. Share it with your medical expert."}</UiText></p>}</section>;
}
