"use client";
import {UiText,useUi} from "./ui-text";
import dynamic from "next/dynamic";
import {useEffect,useRef,useState} from "react";
import {equipmentNames} from "./equipment-catalog";
const ChapterScene=dynamic(()=>import("./chapter-scene").then(m=>m.ChapterScene),{ssr:false});
const steps=[{name:"UNDERSTAND",serif:"One clear instruction.",description:"Read or listen to the instructions your doctor approved. Keep the original source close, and take one detail at a time."},{name:"EXPLAIN BACK",serif:"In your own words.",description:"Share what you understood. A confirmed voice transcript or a written answer gives your care team something concrete to review."},{name:"CLARIFY",serif:"Make room for questions.",description:"Go back to the approved instruction. When a detail is missing or unclear, ask the people who know your care."}];
export function GalleryChapter(){ const ui=useUi();
 const root=useRef<HTMLDivElement>(null);const [active,setActive]=useState(0);
 const drag=useRef<{x:number;progress:number}|null>(null);
 useEffect(()=>{const el=root.current;if(!el)return;const reduce=matchMedia("(prefers-reduced-motion: reduce)");let raf=0,last=performance.now(),current=0;const tick=(now:number)=>{raf=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden || reduce.matches)return;const b=el.getBoundingClientRect(),distance=el.offsetHeight-(el.firstElementChild as HTMLElement).offsetHeight;const target=Math.max(0,Math.min(1,-b.top/Math.max(1,distance)/.72))*2;current+=(target-current)*(1-Math.exp(-7.5*dt));el.style.setProperty("--gallery-progress",String(current));setActive(previous=>{const next=Math.round(current);return previous===next?previous:next;});};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[]);
 function choose(index:number){setActive(index);const el=root.current;if(!el)return;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;el.style.setProperty("--gallery-progress",String(index));if(!reduce)window.scrollTo({top:scrollY+el.getBoundingClientRect().top+index/2*.72*(el.offsetHeight-(el.firstElementChild as HTMLElement).offsetHeight),behavior:"smooth"});}
 return <div ref={root} className="gallery-stage" data-active={active}><div className="gallery-chapter"><div className="gallery-count"><span className="eyebrow"><UiText>{"02 — THE NEXT CLEAR STEP"}</UiText></span><span className="rolling-count" key={active}>0<UiText>{active+1}</UiText><small> / 03</small></span><span className="equipment-label"><UiText>{equipmentNames[active]}</UiText></span></div><ChapterScene variant="gallery"/><div className="gallery-drag-zone" aria-hidden="true" onPointerDown={e=>{if(e.pointerType!=="mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches)return;drag.current={x:e.clientX,progress:Number(root.current?.style.getPropertyValue("--gallery-progress") || 0)};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const el=root.current;if(!drag.current || !el)return;const next=Math.max(0,Math.min(2,drag.current.progress-(e.clientX-drag.current.x)/Math.max(1,innerWidth)*3));window.scrollTo({top:scrollY+el.getBoundingClientRect().top+next/2*.72*(el.offsetHeight-(el.firstElementChild as HTMLElement).offsetHeight),behavior:"instant"});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/><div className="gallery-caption" key={active}><span className="gallery-serif"><UiText>{steps[active].serif}</UiText></span><h2><UiText>{steps[active].name}</UiText></h2><p><UiText>{steps[active].description}</UiText></p></div><div className="gallery-controls" aria-label={ui("Care steps")}>{steps.map((s,i)=><button key={s.name} onClick={()=>choose(i)} aria-pressed={active===i}><span>0<UiText>{i+1}</UiText></span><UiText>{s.name}</UiText><i aria-hidden="true">↗</i></button>)}</div><span className="chapter-scroll-label" aria-hidden="true"><UiText>{"DRAG · SCROLL · EXPLORE"}</UiText></span></div></div>;
}
const claritySteps=[{word:"READ.",serif:"One detail at a time.",note:"Start with your doctor’s approved instructions. Read them, or listen in your language."},{word:"EXPLAIN.",serif:"In your own words.",note:"Share what you understood. Your answer helps your care team see where clarity is needed."},{word:"CLARIFY.",serif:"Together, with care.",note:"Questions are welcome. Keep the original instruction close and ask your care team about unclear details."}];
export function TypographyChapter(){ const ui=useUi();
 const root=useRef<HTMLDivElement>(null);const [active,setActive]=useState(0);
 useEffect(()=>{
  const el=root.current;if(!el)return;const reduce=matchMedia("(prefers-reduced-motion: reduce)");const words=el.querySelectorAll<HTMLElement>(".depth-word");let raf=0,last=performance.now(),current=.18;
  const update=(now:number)=>{
   raf=requestAnimationFrame(update);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden || reduce.matches)return;
   const bounds=el.getBoundingClientRect(),distance=el.offsetHeight-(el.firstElementChild as HTMLElement).offsetHeight;
   const target=.18+Math.max(0,Math.min(1,-bounds.top/Math.max(1,distance)/.8))*2.72;
   current+=(target-current)*(1-Math.exp(-7.5*dt));if(bounds.top>innerHeight || bounds.bottom<0)return;
   const index=Math.min(2,Math.floor(current));el.dataset.word=String(index);setActive(previous=>previous===index?previous:index);
   words.forEach((word,k)=>{
    const u=Math.max(0,Math.min(1,current-k)),visible=k===index;
    word.style.opacity=visible?String(Math.min(1,u/.13)*(k===2?1:1-Math.max(0,(u-.79)/.21))):"0";
    word.style.setProperty("--clarity-enter",String(Math.min(1,u/.3)));
    word.style.setProperty("--clarity-exit",String(k===2?0:Math.max(0,(u-.72)/.28)));
    word.querySelectorAll<HTMLElement>(".depth-char").forEach((char,i)=>{
     const reveal=Math.max(0,Math.min(1,(u-.012*i)/.15)),exit=k===2?0:Math.max(0,(u-.72)/.28);
     char.style.transform=`translate3d(0,${(1-reveal)*.45-exit*.3}em,0) rotateX(${(1-reveal)*-65+exit*12}deg)`;
     char.style.opacity=String(reveal);
    });
   });
  };
  raf=requestAnimationFrame(update);return()=>cancelAnimationFrame(raf);
 },[]);
 return <div ref={root} className="typography-stage clarity-stage"><div className="typography-chapter">
  <span className="eyebrow"><UiText>{"03 — YOUR CARE, IN CONVERSATION"}</UiText></span><span className="clarity-counter" aria-hidden="true">0<UiText>{active+1}</UiText> / 03</span>
  <h2 className="sr-only"><UiText>{"Read your care. Explain in your own words. Find clarity."}</UiText></h2>
  <div className="depth-words" aria-hidden="true">{claritySteps.map(step=><div className="depth-word" key={step.word}><div className="clarity-word"><span className="depth-word-inner">{Array.from(new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(ui(step.word)),({segment:char},i)=><span className="depth-char" key={i}><UiText>{char}</UiText></span>)}</span><em><UiText>{step.serif}</UiText></em></div></div>)}</div>
  <div className="clarity-bottom"><p><UiText>{claritySteps[active].note}</UiText></p><div className="clarity-progress" aria-label={ui("Conversation steps")}>{claritySteps.map((step,i)=><span key={step.word} className={i===active?"is-current":""}><small>0<UiText>{i+1}</UiText></small><UiText>{ui(step.word).replace(".","")}</UiText></span>)}</div></div>
 </div></div>;
}
export function DecorativeChapter({variant}:{variant:"physics"|"rings"}){return <ChapterScene variant={variant}/>;}
