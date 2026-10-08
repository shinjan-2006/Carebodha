import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";
import {LanguageProvider} from "@/components/language-provider";
export const metadata: Metadata={title:"CareBodha — Understand your care",description:"Understand your care. Follow it with confidence. Read approved care instructions, explain them back, and involve your family.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">Skip to content</a><LanguageProvider>{children}</LanguageProvider></body></html>;
}
