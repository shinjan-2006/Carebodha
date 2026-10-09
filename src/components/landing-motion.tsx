"use client";
import {useEffect,useState,type RefObject,type CSSProperties} from "react";
import {useUi} from "./ui-text";
import {useLanguage} from "./language-provider";

// MATTER's letter reveal delays and easing, with one accessible text label.
export function MotionText({text,line=0,step,delay}:{text:string;line?:number;step?:number;delay?:number}) {
  const ui=useUi();text=ui(text);
  let index=0;
  return <span className="motion-text" aria-hidden="true">{text.split(/(\s+)/).map((word,w)=><span className="motion-word" key={w}>{Array.from(new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(word),({segment:char})=>{const i=index++;return <span key={i} className={`motion-char${char===" "?" motion-space":""}`} style={{"--char-delay":`${(delay??(line===1?700:120))+i*(step??(line===1?45:55))}ms`} as CSSProperties}>{char===" "?"\u00a0":char}</span>;})}</span>)}</span>;
}
const range=(v:number,a:number,b:number)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
/** Shared scroll timeline. CSS sticky preserves wheel, touch, PageDown and anchors. */
export function useLandingMotion(root:RefObject<HTMLDivElement|null>) {
  const {language}=useLanguage();
  const [motionEnabled,setMotionEnabled]=useState(true);
  useEffect(()=>{
    const el=root.current;if(!el)return;
    const stage=el.querySelector<HTMLElement>(".hero-stage"),hero=el.querySelector<HTMLElement>(".hero");if(!stage || !hero)return;
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");
    const gallery=el.querySelector<HTMLElement>(".gallery-stage"),clarity=el.querySelector<HTMLElement>(".clarity-stage"),teachback=el.querySelector<HTMLElement>(".editorial-teachback");
    const revealed=el.querySelectorAll<HTMLElement>(".marketing-section .eyebrow,.marketing-section h2,.step-card,.demo-panel,.family-preview");
    const magnets=Array.from(el.querySelectorAll<HTMLElement>(".editorial-link .motion-char"),node=>({node,x:0,y:0,vx:0,vy:0,tx:0,ty:0}));
    const pointer=(event:PointerEvent)=>{
      if(reduce.matches || event.pointerType!=="mouse")return;
      const bounds=magnets.map(m=>m.node.getBoundingClientRect());
      magnets.forEach((m,i)=>{const b=bounds[i],dx=event.clientX-b.left-b.width/2,dy=event.clientY-b.top-b.height/2,d=Math.hypot(dx,dy),strength=Math.max(0,1-d/110)*.42;m.tx=Math.max(-10,Math.min(10,dx*strength));m.ty=Math.max(-8,Math.min(8,dy*strength));});
    };
    const leave=()=>magnets.forEach(m=>{m.tx=m.ty=0;});el.addEventListener("pointermove",pointer,{passive:true});el.addEventListener("pointerleave",leave);
    let raf=0,last=performance.now(),smoothed=0,previous=0,stretch=1,stretchVelocity=0,introTimer:ReturnType<typeof setTimeout>;
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add("is-revealed");observer.unobserve(entry.target);}},{threshold:.12});
    const outroObserver=new IntersectionObserver(([entry])=>el.classList.toggle("outro-dark",entry.isIntersecting && entry.intersectionRatio>.25),{threshold:[0,.25,.5]});
    const outro=el.querySelector(".final-cta");if(outro)outroObserver.observe(outro);
    function preference(){
      setMotionEnabled(!reduce.matches);
      el!.classList.toggle("motion-enabled",!reduce.matches);
      if(reduce.matches)el!.classList.remove("chapter-dark");
      if(reduce.matches)magnets.forEach(m=>{m.node.style.removeProperty("translate");m.x=m.y=m.vx=m.vy=m.tx=m.ty=0;});
      revealed.forEach(node=>{node.classList.add("motion-reveal");if(reduce.matches)node.classList.add("is-revealed");else observer.observe(node);});
      clearTimeout(introTimer);el!.dataset.intro=reduce.matches?"done":"running";
      if(!reduce.matches)introTimer=setTimeout(()=>{el!.dataset.intro="done";},3200);
      if(reduce.matches){hero!.style.removeProperty("--chapter");hero!.style.removeProperty("--hero-opacity");hero!.style.removeProperty("--hero-y");hero!.style.removeProperty("--copy-y");hero!.style.removeProperty("--cta-y");hero!.style.removeProperty("--label-y");hero!.style.removeProperty("--stretch");hero!.style.removeProperty("--motion-blur");hero!.style.removeProperty("--dark");hero!.style.removeProperty("--chapter-note");}
    }
    preference();reduce.addEventListener("change",preference);
    const run=(now:number)=>{
      raf=requestAnimationFrame(run);const dt=Math.min(.05,(now-last)/1000);last=now;if(reduce.matches || document.hidden)return;
      const bounds=stage!.getBoundingClientRect(),distance=Math.max(1,stage!.offsetHeight-hero!.offsetHeight);
      if(gallery){const b=gallery.getBoundingClientRect();const enter=range(innerHeight-b.top,0,innerHeight*.8),exit=range(innerHeight-b.bottom,0,innerHeight*.8);gallery.style.setProperty("--gallery-in",String(enter*enter*(3-2*enter)));gallery.style.setProperty("--gallery-out",String(exit*exit*(3-2*exit)));}
      if(clarity){const b=clarity.getBoundingClientRect(),enter=range(innerHeight-b.top,0,innerHeight*.8),exit=range(innerHeight-b.bottom,0,innerHeight*.75);clarity.style.setProperty("--clarity-in",String(enter*enter*(3-2*enter)));clarity.style.setProperty("--clarity-out",String(exit*exit*(3-2*exit)));}
      if(teachback){const enter=range(innerHeight-teachback.getBoundingClientRect().top,0,innerHeight*.75);teachback.style.setProperty("--teachback-in",String(enter*enter*(3-2*enter)));}
      for(const m of magnets){if(Math.abs(m.vx)+Math.abs(m.vy)+Math.abs(m.tx-m.x)+Math.abs(m.ty-m.y)<.01)continue;const h=Math.min(dt,1/30);m.vx+=(160*(m.tx-m.x)-15*m.vx)*h;m.vy+=(160*(m.ty-m.y)-15*m.vy)*h;m.x+=m.vx*h;m.y+=m.vy*h;m.node.style.translate=`${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;}
      const target=stage!.dataset.scene==="fallback"?0:range(-bounds.top,0,distance)*7;
      smoothed+=(target-smoothed)*(1-Math.exp(-7.5*dt));
      const velocity=(smoothed-previous)/Math.max(dt,.001);previous=smoothed;
      if(bounds.bottom<0 && Math.abs(velocity)<.001){el!.classList.remove("chapter-dark");return;}
      const wanted=1+Math.min(Math.abs(velocity)*.035,.14);
      stretchVelocity+=(60*(wanted-stretch)-10*stretchVelocity)*dt;stretch+=stretchVelocity*dt;
      const hp=range(smoothed,0,1.35),dark=range(smoothed,2.7,3.45),smoothDark=dark*dark*(3-2*dark);
      hero!.style.setProperty("--chapter",smoothed.toFixed(4));
      hero!.dataset.progress=smoothed.toFixed(4);hero!.dataset.velocity=velocity.toFixed(4);
      hero!.style.setProperty("--hero-opacity",(1-range(smoothed,.55,1.05)).toFixed(4));
      hero!.style.setProperty("--hero-y",`${-hp*34}vh`);hero!.style.setProperty("--copy-y",`${-hp*18}vh`);hero!.style.setProperty("--cta-y",`${-hp*26}vh`);hero!.style.setProperty("--label-y",`${-hp*12}vh`);
      hero!.style.setProperty("--stretch",stretch.toFixed(4));hero!.style.setProperty("--motion-blur",`${Math.min(Math.abs(velocity)*.32,2.4).toFixed(2)}px`);
      hero!.style.setProperty("--dark",smoothDark.toFixed(4));hero!.style.setProperty("--chapter-note",(range(smoothed,2.85,3.35)*(1-range(smoothed,3.7,4))).toFixed(4));
      const matter=range(smoothed,4,6.6),appear=range(smoothed,4,4.4)*(1-range(smoothed,6.35,6.7));
      hero!.style.setProperty("--matter-opacity",appear.toFixed(4));hero!.style.setProperty("--matter-x",`${14-60*matter}vw`);hero!.style.setProperty("--matter-y",`${-14+60*matter}vw`);
      const zoom=range(smoothed,6.3,7);
      hero!.style.setProperty("--zoom-opacity",(range(smoothed,6.1,6.35)*(1-range(smoothed,6.94,7))).toFixed(4));hero!.style.setProperty("--zoom-scale",(1+72*zoom*zoom*zoom).toFixed(4));
      const handoff=range(smoothed,6.55,7);hero!.style.setProperty("--handoff-white",String(handoff*handoff*(3-2*handoff)));
      stage!.dataset.chapter=smoothed<1.3?"ribbon":smoothed<2.6?"grid":smoothed<4?"depth":"matter";
      el!.classList.toggle("chapter-dark",smoothDark>.5 && handoff<.08 && bounds.bottom>hero!.offsetHeight*.7);
    };
    raf=requestAnimationFrame(run);
    // Focus never stays on an invisible outgoing hero action.
    const focusHero=(event:FocusEvent)=>{if(!reduce.matches && stage!.dataset.scene!=="fallback" && event.target instanceof HTMLElement && event.target.matches(":focus-visible") && Number(hero!.dataset.progress || 0)>.6)stage!.scrollIntoView({behavior:"instant",block:"start"});};
    hero.addEventListener("focusin",focusHero);
    return()=>{cancelAnimationFrame(raf);clearTimeout(introTimer);observer.disconnect();outroObserver.disconnect();reduce.removeEventListener("change",preference);hero.removeEventListener("focusin",focusHero);el.removeEventListener("pointermove",pointer);el.removeEventListener("pointerleave",leave);};
  },[root,language]);
  return motionEnabled;
}
