"use client";
import {UiText} from "./ui-text";
import {useEffect,useState} from "react";
import {Brand} from "./brand";
import Link from "next/link";
import {Users} from "lucide-react";
export default function InviteScreen() {
  const [token,setToken]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [signin,setSignin]=useState(false);const [success,setSuccess]=useState(false);
  useEffect(()=>{setToken(new URLSearchParams(window.location.search).get("token") || "");},[]);
  async function accept(){setBusy(true);try {const r=await fetch("/api/v1/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});const b=await r.json();if(r.status===401)setSignin(true);if(!r.ok)setMessage(b.error?.message || "Invitation unavailable.");else{setSuccess(true);setMessage("Invitation accepted. You can now open the instructions shared with you.");}}catch{setMessage("Please try again.");}finally{setBusy(false);}}
  return <main id="main" className="invite-page"><Brand/><section className="auth-card"><Users size={40} className="violet"/><h1><UiText>{"You’re invited to help."}</UiText></h1><p><UiText>{"The patient chooses what you can access. Sign in with the invited email to accept this single-use invitation."}</UiText></p>{message && <div role="status" className={`alert ${success?"green":"amber"}`}><UiText>{message}</UiText></div>}{success?<Link className="button primary full" href="/app"><UiText>{"Open shared care"}</UiText></Link>:<button className="button primary full" disabled={busy || !token} onClick={accept}><UiText>{busy?"Accepting…":"Accept invitation"}</UiText></button>}{signin && <Link className="button secondary full" href={`/signin?token=${encodeURIComponent(token)}`}><UiText>{"Sign in with invited email"}</UiText></Link>}<Link className="back-link" href={`/register?token=${encodeURIComponent(token)}`}><UiText>{"Create an account with your invited email"}</UiText></Link></section></main>;
}
