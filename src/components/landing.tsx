"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import { AudioLines, ShieldCheck, Languages, Users, MessageCircle, Sparkles, Volume2, CircleCheck, Stethoscope } from "lucide-react";
import {Brand} from "./brand";
import dynamic from "next/dynamic";
import {speak} from "@/lib/speech";
import {RibbonFallback} from "./ribbon-fallback";
import {MotionText,useLandingMotion} from "./landing-motion";
import {MatterCursor} from "./matter-cursor";
import {GalleryChapter,TypographyChapter} from "./immersive-chapters";
import {ClosingChapters} from "./closing-chapters";
import {LanguageSwitch,useLanguage} from "./language-provider";
const ChromeScene=dynamic(()=>import("./chrome-scene").then(m=>m.ChromeScene),{ssr:false,loading:()=> <div className="chrome-scene"><RibbonFallback/></div>});
export default function Landing({demo=false}:{demo?:boolean}) {
  const {language,t}=useLanguage();
  const [answer,setAnswer]=useState("I will take one tablet once daily after food.");const [result,setResult]=useState(false);
  const [menu,setMenu]=useState(false);const [closingMenu,setClosingMenu]=useState(false);const menuButton=useRef<HTMLButtonElement>(null);const menuPanel=useRef<HTMLElement>(null);
  const experience=useRef<HTMLDivElement>(null);const motionEnabled=useLandingMotion(experience);
  useEffect(()=>{if(menu)menuPanel.current?.querySelector<HTMLAnchorElement>("a")?.focus();},[menu]);
  useEffect(()=>{if(!menu)return;const key=(event:KeyboardEvent)=>{if(event.key==="Escape") {setMenu(false);setClosingMenu(true);menuButton.current?.focus();}if(event.key==="Tab" && event.target===menuButton.current){event.preventDefault();const links=menuPanel.current?.querySelectorAll<HTMLAnchorElement>("a");(event.shiftKey?links?.[links.length-1]:links?.[0])?.focus();}};const previous=document.body.style.overflow;document.body.style.overflow="hidden";document.addEventListener("keydown",key);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",key);};},[menu]);
  useEffect(()=>{if(!closingMenu)return;const timer=setTimeout(()=>setClosingMenu(false),matchMedia("(prefers-reduced-motion: reduce)").matches?0:950);return()=>clearTimeout(timer);},[closingMenu]);
  function closeMenu(){setMenu(false);setClosingMenu(true);menuButton.current?.focus();}
  return <div ref={experience} className={`landing-experience${motionEnabled?" motion-enabled":""}${menu || closingMenu?" menu-is-open":""}`}>
    <MatterCursor/>
    <header className="landing-nav"><Brand/><div className="landing-nav-actions"><LanguageSwitch/><button ref={menuButton} className="landing-menu-button" aria-expanded={menu} aria-controls="landing-menu" onClick={()=>{if(menu)closeMenu();else{setClosingMenu(false);setMenu(true);}}}>{menu?t("close").toUpperCase():t("menu").toUpperCase()}<span aria-hidden="true" className={menu?"menu-lines is-open":"menu-lines"}/></button></div></header>
    {(menu || closingMenu) && <nav ref={menuPanel} id="landing-menu" className={`landing-menu ${menu?"is-open":"is-closing"}`} inert={closingMenu} aria-label="Main navigation" onKeyDown={e=>{if(e.key==="Tab"){const links=menuPanel.current?.querySelectorAll<HTMLAnchorElement>("a");if(links && ((!e.shiftKey && document.activeElement===links[links.length-1]) || (e.shiftKey && document.activeElement===links[0]))){e.preventDefault();e.stopPropagation();menuButton.current?.focus();}}}}><div className="menu-links"><span className="eyebrow">FIND YOUR NEXT CLEAR STEP</span>{[{href:"#how-it-works",label:t("how"),index:"01"},{href:"#teach-back",label:t("teachback"),index:"02"},{href:"#family",label:t("family"),index:"03"}].map(l=><a key={l.href} aria-label={l.label} href={l.href} onClick={closeMenu}><small>{l.index}</small><span>{l.label}</span><i aria-hidden="true">↗</i></a>)}<Link href="/app" aria-label={t("open")} onClick={closeMenu}><small>04</small><span>{t("open")}</span><i aria-hidden="true">↗</i></Link></div><div className="menu-meta"><span className="eyebrow">YOUR CARE. YOUR LANGUAGE.</span><p>Clarity<br/><em>begins here.</em></p><div className="menu-account"><Link href="/signin" onClick={closeMenu}>{t("signin")} →</Link><Link href="/register" onClick={closeMenu}>{t("register")} ↗</Link><Link href="/expert/signin" onClick={closeMenu}>Medical expert sign-in →</Link></div><span>Doctor-approved instructions.<br/>One clear step at a time.</span></div><div className="menu-bottom"><span>CAREBODHA</span><span>UNDERSTANDING IS THE FIRST STEP.</span></div></nav>}
    <main id="main" inert={menu}>
      <div className="hero-stage"><section className="hero">
        <div className="hero-art"><ChromeScene/></div>
        <span className="hero-label eyebrow">01 — UNDERSTANDING YOUR CARE</span>
        <h1 className={`hero-title${language!=="en"?" translated-hero":""}`} aria-label={t("hero")}>{language==="en"?<><span className="hero-line hero-line-one"><MotionText text="UNDERSTAND"/></span><span className="hero-line hero-line-two"><MotionText text="YOUR CARE" line={1}/></span></>:t("hero")}</h1>
        <p className="hero-serif">with <em>clarity.</em></p>
        <p className="hero-description">{t("description")}</p>
        <div className="hero-buttons"><Link className="editorial-link" href="/app" aria-label={`${t("open").toUpperCase()} →`}><MotionText text={`${t("open").toUpperCase()} →`}/></Link><Link className="editorial-link secondary-link" href={demo?"/signin?demo=patient":"/register"} aria-label={demo?"TRY THE DEMO":t("register").toUpperCase()}><MotionText text={demo?"TRY THE DEMO":t("register").toUpperCase()}/></Link></div>
        <a className="hero-scroll" href="#how-it-works">SCROLL<span aria-hidden="true"/></a>
        <div className="hero-rail" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <div className="chapter-note" aria-hidden="true"><span>YOUR CARE.</span><em>Made clear.</em></div>
        <div className="matter-type-chapter" aria-hidden="true"><div className="matter-type-line matter-type-one">CARE SHOULD</div><div className="matter-type-line matter-type-two">FEEL CLEAR.</div><p>Your instructions are the starting point.<br/>Understanding is what comes next.</p><span className="matter-type-zoom">CLEAR.</span></div>
        <div className="gallery-handoff" aria-hidden="true"/>
      </section></div>
      <section className="trust-strip transition-trust"><span>YOUR CARE, MADE CLEAR</span><div><Stethoscope size={18}/> Doctor-approved instructions</div><div><Languages size={18}/> Seven language preferences</div><div><AudioLines size={18}/> Read, listen, explain</div><div><Users size={18}/> Family, with your permission</div></section>
      <section id="how-it-works" className="how-section immersive-how"><GalleryChapter/></section>
      <TypographyChapter/><section id="teach-back" className="marketing-section demo-section editorial-teachback"><div className="demo-copy"><span className="eyebrow">A CONVERSATION, NOT A TEST</span><h2 aria-label="Make sense of your care."><MotionText text="MAKE SENSE"/><br/><em><MotionText text="of your care." line={1}/></em></h2><p>A small misunderstanding deserves a clear explanation. Teach-back compares your words with your approved instruction, one detail at a time.</p><div className="mini-feature"><CircleCheck/>Specific, supportive feedback</div><div className="mini-feature"><ShieldCheck/>Your approved plan stays the source</div><span className="muted">A match checks understanding; it does not confirm safety or adherence.</span></div><div className="demo-panel"><div className="panel-top"><span><Sparkles size={16}/> Try a teach-back</span><span className="badge">ILLUSTRATIVE EXAMPLE</span></div><div className="approved-passage"><span className="micro-label">APPROVED INSTRUCTION</span><p>Take one tablet of Demo Medicine A twice daily after food.</p></div><label htmlFor="demo-answer">In your own words, how will you take it?</label><select id="demo-answer" value={answer} onChange={e=>{setAnswer(e.target.value);setResult(false);}}><option>I will take one tablet once daily after food.</option><option>I will take one tablet twice daily after food.</option><option>I will take one tablet.</option></select>{result?<div className={`demo-result ${answer.includes("once")?"amber":"green"}`} role="status"><strong>{answer.includes("once")?"Mismatch detected — frequency":answer.includes("twice")?"Agreement with the checked details":"Incomplete — frequency and timing"}</strong><p>{answer.includes("once")?"You said ‘once daily.’ Your approved instruction says ‘twice daily.’":answer.includes("twice")?"Your answer agrees with the dose, unit, frequency, and timing in this fictional instruction.":"You did not state frequency or timing. Read the approved instruction again."}</p><span className="micro-label">DETERMINISTIC DEMO COMPARISON</span></div>:<button className="button primary full" onClick={()=>setResult(true)}>Check my understanding</button>}<div className="demo-actions"><button onClick={()=>setResult(false)}>Try again</button><button onClick={()=>speak("Take one tablet of Demo Medicine A twice daily after food.")}><Volume2 size={15}/> Listen again</button><Link href={demo?"/signin?demo=patient":"/app"}>Ask the care team</Link></div></div></section>
      <ClosingChapters demo={demo}/>
    </main><footer className="footer"><Brand/><span>Understand your care. Follow it with confidence.</span><Link href="/signin">Sign in</Link><span>© {new Date().getFullYear()} CareBodha</span></footer>
  </div>;
}
