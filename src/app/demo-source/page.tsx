import {demoSources} from "@/lib/ai";
import {Brand} from "@/components/brand";
import Link from "next/link";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export default function Page(){if(process.env.APP_MODE!=="demo")notFound();return <main id="main" className="demo-source-page"><Brand/><h1>Fictional demo documents</h1><p>Copy one source exactly into the clinician document-upload screen. These contain invented medicines and are not real prescriptions.</p>{demoSources.map((s,n)=><section className="panel" key={n}><h2>Discharge document {n+1}</h2><pre>{s}</pre></section>)}<Link href="/app/upload" className="button primary">Back to document upload</Link></main>;}
