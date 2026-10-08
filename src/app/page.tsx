import Landing from "@/components/landing";
export const dynamic="force-dynamic";
export default function Page() {return <Landing demo={process.env.APP_MODE==="demo"}/>;}
