import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {auth} from "@/lib/auth";
import Workspace from "@/components/workspace";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{section?:string[]}>}) {
  const session=await auth.api.getSession({headers:await headers()});if(!session) redirect("/signin");
  const {section}=await params;return <Workspace section={section?.[0] || "overview"}/>;
}
