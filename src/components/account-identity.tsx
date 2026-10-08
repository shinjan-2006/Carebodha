"use client";
import {useState} from "react";
import {authClient} from "@/lib/auth-client";
import {normalizeUsername,usernamePattern} from "@/lib/usernames";
export function AccountIdentity({user,refresh}:{user:{email:string;username?:string|null};refresh:()=>Promise<void>}) {
  const [username,setUsername]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");setSaved(false);const value=normalizeUsername(username);
    if(!usernamePattern.test(value)){setError("Use 3–30 letters, numbers, or underscores.");return;}
    setPending(true);
    try{const result=await authClient.updateUser({username:value});if(result.error)throw new Error(result.error.message || "That username is unavailable. Choose another.");await refresh();setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setPending(false);}
  }
  return <section className="panel account-identity"><span className="micro-label">YOUR PATIENT IDENTIFIER</span><h2>Connect with your medical expert.</h2><p>Share your registered email or username so your expert can assign your care plan.</p><dl><dt>Email address</dt><dd>{user.email}</dd>{user.username && <><dt>Username</dt><dd>@{user.username}</dd></>}</dl>{!user.username && <form onSubmit={submit}><label>Choose a username<input aria-label="Choose a username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]{3,30}" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><p className="field-help">Choose once. Use 3–30 letters, numbers, or underscores.</p><button className="button secondary" disabled={pending}>Save username</button></form>}{error && <p className="alert red" role="alert">{error}</p>}{saved && <p className="connection-success" role="status">Username saved. You can also use it to sign in.</p>}</section>;
}
