"use client";
import {UiText,useUi} from "./ui-text";
import Link from "next/link";
import {useEffect,useRef} from "react";
import {MotionText} from "./landing-motion";
import {DecorativeChapter} from "./immersive-chapters";

const smooth=(value:number)=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
/** Sequential native-scroll chapters: the sculpture clears before the outro enters. */
export function ClosingChapters({demo}:{demo:boolean}){ const ui=useUi();
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=root.current;if(!el)return;
    const family=el.querySelector<HTMLElement>("#family")!,final=el.querySelector<HTMLElement>(".final-cta")!,experience=el.closest<HTMLElement>(".landing-experience")!;
    const frame=el.querySelector<HTMLElement>(".closing-frame")!;
    const teachback=el.previousElementSibling as HTMLElement|null;
    const finalTitle=final.querySelector<HTMLElement>("h2")!;finalTitle.classList.add("motion-reveal");
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");let raf=0,held=0,entry=0,last=performance.now();
    const update=(now:number)=>{
      raf=requestAnimationFrame(update);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;
      const support=el.querySelector<HTMLElement>(".support-stage")!;const bounds=support.getBoundingClientRect();
      experience.classList.toggle("support-dark",bounds.top<70 && bounds.bottom>80);
      if(reduce.matches){family.inert=final.inert=false;finalTitle.classList.add("is-revealed");el.style.removeProperty("--support-enter");teachback?.style.removeProperty("--teachback-out");el.style.removeProperty("--support-out");el.style.removeProperty("--outro-in");family.style.removeProperty("--support-break");return;}
      // Fade the light teach-back chapter into the dark glass scene as it enters.
      const entryTarget=smooth((innerHeight-bounds.top)/(innerHeight*.9));
      entry+=(entryTarget-entry)*(1-Math.exp(-7*dt));
      el.style.setProperty("--support-enter",String(entry));
      teachback?.style.setProperty("--teachback-out",String(entry));
      const distance=Math.max(1,support.offsetHeight-frame.offsetHeight);
      const heldTarget=Math.max(0,Math.min(1,-bounds.top/distance))*3.3;
      // Keep short native scroll travel, but let shell breakup play for ~2 seconds
      // even when a wheel step or swipe reaches the end of the scroll range at once.
      const delta=heldTarget-held,eased=delta*(1-Math.exp(-7*dt));
      held+=Math.sign(delta)*Math.min(Math.abs(eased),dt*(delta>0?1.05:3.3));
      const outgoing=smooth((innerHeight-bounds.bottom)/(innerHeight*.8))*.45,incoming=smooth((innerHeight-final.getBoundingClientRect().top)/(innerHeight*.7));
      el.style.setProperty("--support-out",String(outgoing));el.style.setProperty("--outro-in",String(incoming));
      finalTitle.classList.toggle("is-revealed",incoming>.02);
      family.style.setProperty("--support-progress",String(held));
      const breakT=Math.max(0,Math.min(1,(held-.75)/2));
      family.style.setProperty("--support-break",String(breakT));
      // Invisible outgoing controls cannot take focus. The incoming section remains
      // keyboard reachable and scrolls into place when one of its controls is focused.
      family.inert=outgoing>.98;
      el.dataset.transition=incoming<.01?"support":incoming<.995?"crossfade":"outro";
    };
    const finish=()=>final.scrollIntoView({behavior:reduce.matches?"instant":"smooth",block:"start"});
    const cue=el.querySelector<HTMLAnchorElement>(".support-scroll")!;
    const navigate=(event:MouseEvent)=>{if(reduce.matches)return;event.preventDefault();finish();};
    const focus=(event:FocusEvent)=>{if(!reduce.matches && final.contains(event.target as Node) && Number(el.style.getPropertyValue("--outro-in"))<.999)final.scrollIntoView({behavior:"instant",block:"start"});};
    cue.addEventListener("click",navigate);
    final.addEventListener("focusin",focus);raf=requestAnimationFrame(update);
    return()=>{cancelAnimationFrame(raf);cue.removeEventListener("click",navigate);final.removeEventListener("focusin",focus);experience.classList.remove("support-dark");teachback?.style.removeProperty("--teachback-out");family.inert=false;};
  },[]);
  return <div ref={root} className="closing-stage"><div className="support-stage"><div className="closing-frame">
    <section id="family" className="marketing-section family-section immersive-family"><div className="family-chapter">
      <DecorativeChapter variant="physics"/>
      <span className="eyebrow"><UiText>{"05 — CARE IS BETTER WITH SUPPORT"}</UiText></span><span className="support-corner"><UiText>{"SHARE ONLY WHAT YOU CHOOSE"}</UiText></span>
      <div className="support-title"><h2 aria-label={ui("Care is better. Together.")}><MotionText text="CARE IS BETTER." step={30} delay={0}/><br/><em><MotionText text="Together." step={30} delay={450}/></em></h2></div>
      <div className="family-editorial-copy"><p><UiText>{"Someone you trust."}</UiText><br/><UiText>{"The support you choose."}</UiText></p><span><UiText>{"Share approved instructions, reminders, or questions with family. You control their access, and can revoke it any time."}</UiText></span><Link className="editorial-link" href={demo?"/signin?demo=patient":"/app/family"} aria-label={ui("Explore family assistance")}><MotionText text="EXPLORE FAMILY ASSISTANCE →"/></Link></div>
      <a className="support-scroll" href="#care-next"><UiText>{"SCROLL DOWN "}</UiText><span aria-hidden="true">↓</span></a>
    </div></section>
    </div></div><section id="care-next" className="final-cta"><DecorativeChapter variant="rings"/><div className="eyebrow"><UiText>{"CLARITY FOR THE NEXT STEP"}</UiText></div><h2 aria-label={ui("Understand your care. Follow it with confidence.")}><MotionText text="Understand your care."/><br/><span><MotionText text="Follow it with confidence." line={1}/></span></h2><Link className="button primary" href="/app"><UiText>{"Open CareBodha"}</UiText></Link><p><UiText>{"Explaining your doctor’s instructions. Always grounded in your plan."}</UiText></p></section>
  </div>;
}
