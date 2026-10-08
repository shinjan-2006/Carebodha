import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {auth} from "@/lib/auth";
import {db,mode} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Page(){
 const session=await auth.api.getSession({headers:await headers()});if(!session)redirect("/expert/signin");
 const user=await db.user.findUnique({where:{id:session.user.id}});
 if(!user || user.dataMode!==mode)redirect("/expert/signin");
 redirect(user.role==="CLINICIAN"?"/app/patients":"/app");
}
