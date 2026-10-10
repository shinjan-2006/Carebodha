import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";
import {LanguageProvider} from "@/components/language-provider";
import {UiText} from "@/components/ui-text";
import {SiteCredit} from "@/components/site-credit";
export const metadata: Metadata={title:"CareBodha — Understand your care",description:"Understand your care. Follow it with confidence. Read approved care instructions, explain them back, and involve your family.",icons:{icon:{url:"/carebodha-icon-32.png",type:"image/png",sizes:"32x32"},apple:{url:"/carebodha-icon-192.png",sizes:"192x192"}}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-scroll-behavior="smooth"><body><LanguageProvider><a className="skip-link" href="#main"><UiText>Skip to content</UiText></a>{children}<SiteCredit/></LanguageProvider></body></html>;
}

