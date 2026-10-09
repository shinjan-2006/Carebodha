"use client";
import type {ReactNode} from "react";
import {useLanguage} from "./language-provider";
import {translateUi} from "@/lib/ui-translations";
/** Translate interface copy only. Unknown text (including user content) is verbatim. */
export function useUi(){const {language}=useLanguage();return (text:string)=>translateUi(text,language);}
export function UiText({children}:{children:ReactNode}){const ui=useUi();return typeof children==="string"?ui(children):children;}
