"use client";
import {useState} from "react";
import Link from "next/link";
import {Plus,Users,Upload,ClipboardList} from "lucide-react";

type Patient={id:string;user:{name:string;email:string;username?:string|null}};
export function ExpertPatients({patients,selectedId,assign,select,pending}:{patients:Patient[];selectedId:string|null;assign:(identifier:string)=>Promise<{patientId:string;message:string}>;select:(id:string)=>void;pending:boolean}) {
  const [identifier,setIdentifier]=useState("");const [success,setSuccess]=useState("");
  async function submit(e:React.FormEvent) {
    e.preventDefault();setSuccess("");
    try{const result=await assign(identifier.trim());setSuccess(result.message);setIdentifier("");select(result.patientId);}catch{/* The workspace displays the server's actionable error. */}
  }
  return <div className="expert-patients"><section className="panel connection-panel"><div className="panel-heading"><div><span className="micro-label">01 — CONNECT YOUR PATIENT</span><h2>Care starts with a connection.</h2></div><Plus size={26}/></div><p>Use the email address or username from the patient’s registered CareBodha account. They are connected immediately; no patient acceptance is required.</p><form onSubmit={submit}><label>Patient email or username<input required maxLength={254} autoComplete="off" placeholder="patient@gmail.com or asha_sharma" value={identifier} onChange={e=>{setIdentifier(e.target.value);setSuccess("");}}/></label><button className="button primary" disabled={pending || !identifier.trim()}><Plus size={18}/>Connect patient</button></form>{success && <p className="connection-success" role="status">{success}</p>}<p className="field-help">Upload their source instructions next. A care plan becomes available to the patient only after your review and approval.</p></section><section className="panel"><div className="panel-heading"><h2>Connected patients</h2><Users size={22}/></div>{!patients.length?<p>No patients connected yet. Add a registered patient above to begin.</p>:<div className="connected-patients">{patients.map(patient=><article className="connected-patient" key={patient.id}><div><h3>{patient.user.name}</h3><p>{patient.user.email}{patient.user.username && <><br/>@{patient.user.username}</>}</p></div><div className="card-buttons"><button className="button secondary" aria-pressed={patient.id===selectedId} onClick={()=>select(patient.id)}>{patient.id===selectedId?"Selected":"Select patient"}</button><Link className="button primary" href={`/app/upload?patientId=${encodeURIComponent(patient.id)}`}><Upload size={17}/>Upload care</Link><Link className="button secondary" href={`/app/review?patientId=${encodeURIComponent(patient.id)}`}><ClipboardList size={17}/>Review care</Link></div></article>)}</div>}</section></div>;
}
