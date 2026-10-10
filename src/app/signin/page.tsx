import AuthScreen from "@/components/auth-screen";
import {phoneOtpConfigured} from "@/lib/phone-otp";
export const dynamic="force-dynamic";
export default function Page() {return <AuthScreen  demoPassword={process.env.APP_MODE==="demo" ? process.env.DEMO_SEED_PASSWORD : undefined}/>;}
