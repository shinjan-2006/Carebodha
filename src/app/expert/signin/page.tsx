import AuthScreen from "@/components/auth-screen";
export const dynamic="force-dynamic";
export default function Page(){return <AuthScreen expert demoPassword={process.env.APP_MODE==="demo"?process.env.DEMO_SEED_PASSWORD:undefined}/>;}
