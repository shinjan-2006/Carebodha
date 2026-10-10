import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";
import {LanguageProvider} from "@/components/language-provider";
import {UiText} from "@/components/ui-text";
import {SiteCredit} from "@/components/site-credit";
export const metadata: Metadata={title:"CareBodha — Understand your care",description:"Understand your care. Follow it with confidence. Read approved care instructions, explain them back, and involve your family.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-scroll-behavior="smooth"><body><LanguageProvider><a className="skip-link" href="#main"><UiText>Skip to content</UiText></a>{children}<SiteCredit/></LanguageProvider></body></html>;
}
