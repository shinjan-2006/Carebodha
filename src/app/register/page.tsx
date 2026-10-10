import AuthScreen from "@/components/auth-screen";
import {phoneOtpConfigured} from "@/lib/phone-otp";
export const dynamic="force-dynamic";
export default function Page() {return <AuthScreen register phoneOnly={phoneOtpConfigured()}/>;}
