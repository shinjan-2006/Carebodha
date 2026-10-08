"use client";
import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {createMedicalEquipment} from "./medical-equipment";
import {equipmentNames,type Equipment} from "./equipment-catalog";
import {createMatterFinale,createMatterEnvironment} from "./matter-finale";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import {MedicalFallback} from "./medical-fallback";
// MATTER gallery / physics / final geometry, adapted to care chapters and native scroll.
export function ChapterScene({variant}:{variant:"gallery"|"physics"|"rings"}){
 const host=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false);
 useEffect(()=>{const el=host.current;if(!el)return;const reduce=matchMedia("(prefers-reduced-motion: reduce)");let dispose:(()=>void)|undefined,visible=false;
  function mount(){if(dispose || reduce.matches || !visible)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});}catch{return;}
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.transmissionResolutionScale=.5;el!.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,0,12);
   const environment=variant==="physics"?createMatterEnvironment(renderer):(()=>{const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),result=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();return result;})();scene.environment=environment.texture;
   const chrome=new THREE.MeshPhysicalMaterial({color:variant==="rings"?"#879dff":"#eef0f5",metalness:1,roughness:.08,envMapIntensity:1.4});
   const glass=new THREE.MeshPhysicalMaterial({color:"#9faeff",transmission:.92,thickness:.6,roughness:.06,iridescence:.85,ior:1.46,metalness:0});
   const blue=new THREE.MeshPhysicalMaterial({color:"#234ee0",roughness:.36,metalness:.15,clearcoat:.3});
   const white=new THREE.MeshPhysicalMaterial({color:"#faf9f6",roughness:.26,metalness:.12});
   const ink=new THREE.MeshStandardMaterial({color:"#18233a",roughness:.4});
   const screen=new THREE.MeshPhysicalMaterial({color:"#cedbe9",roughness:.24,metalness:.12});
   const medicalSteel=new THREE.MeshPhysicalMaterial({color:"#8d9eb7",metalness:.8,roughness:.2,clearcoat:.3});
   const medicalGlass=glass.clone();medicalGlass.color.set("#bdcffa");medicalGlass.transmission=.7;medicalGlass.iridescence=.3;
   const materials={chrome:variant==="rings"?chrome:medicalSteel,glass:variant==="rings"?glass:medicalGlass,blue,white,ink,screen};
   const key=new THREE.DirectionalLight("#fff",3),rim=new THREE.DirectionalLight("#8da4ff",2);key.position.set(4,7,6);rim.position.set(-4,3,-2);scene.add(key,rim);
   const groups:THREE.Group[]=[];const geometry:THREE.BufferGeometry[]=[];const add=(g:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{geometry.push(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
   const equipment:Equipment[]=["stethoscope","blood-pressure","iv-stand"];
   if(variant==="gallery")equipment.forEach(kind=>{const g=createMedicalEquipment(kind,materials);g.userData.restZ=g.rotation.z;groups.push(g);scene.add(g);});
   let finale:ReturnType<typeof createMatterFinale>|undefined,composer:EffectComposer|undefined,bloom:UnrealBloomPass|undefined,output:OutputPass|undefined;
   if(variant==="physics"){
    camera.position.z=14;renderer.toneMappingExposure=1;scene.environmentIntensity=.22;scene.background=new THREE.Color("#050506");
    key.position.set(4,8,6);rim.position.set(-7,3,-3);key.intensity=.15;rim.intensity=.2;rim.color.set("#bfd0ff");
    const fill=new THREE.DirectionalLight("#ffffff",.05);fill.position.set(-3,-4,5);scene.add(fill);
    const qualityLow=innerWidth<820;
    glass.color.set(qualityLow?"#dfe4fb":"#ffffff");glass.transmission=qualityLow?0:1;glass.transparent=qualityLow;glass.opacity=qualityLow?.84:1;
    glass.thickness=.8;glass.roughness=.05;glass.clearcoat=1;glass.clearcoatRoughness=.04;glass.iridescence=.75;glass.iridescenceIOR=1.3;glass.iridescenceThicknessRange=[140,520];glass.attenuationColor.set("#b3bfff");glass.attenuationDistance=1.4;glass.envMapIntensity=1.2;
    chrome.color.set("#f2f4f8");chrome.roughness=.07;chrome.envMapIntensity=1.35;chrome.clearcoat=.4;chrome.clearcoatRoughness=.05;
    finale=createMatterFinale(glass,chrome);scene.add(finale.root);
    if(!qualityLow){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.55,.6,.92);composer.addPass(bloom);output=new OutputPass();composer.addPass(output);}
   }
   if(variant==="rings"){renderer.toneMappingExposure=1.5;chrome.color.set("#a6b9ff");chrome.envMapIntensity=2;chrome.emissive.set("#294cff");chrome.emissiveIntensity=.18;const g=new THREE.Group();groups.push(g);scene.add(g);for(let i=0;i<9;i++){const m=add(g,new THREE.TorusGeometry(1.5+i*.28,.055,12,100),i%3===0?glass:chrome);m.rotation.x=i*.075;}}
   let raf=0,last=performance.now(),time=0,px=0,py=0;const parent=el!.closest<HTMLElement>(".gallery-stage,.family-section,.final-cta") || el!;
   const pointer=(e:PointerEvent)=>{if(e.pointerType!=="mouse")return;const b=el!.getBoundingClientRect();px=(e.clientX-b.left)/b.width-.5;py=.5-(e.clientY-b.top)/b.height;};const leave=()=>{px=py=0;};parent.addEventListener("pointermove",pointer,{passive:true});parent.addEventListener("pointerleave",leave);
   const tick=(now:number)=>{raf=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(!visible || document.hidden)return;time+=dt;
    if(variant==="gallery"){const progress=Number(parent.style.getPropertyValue("--gallery-progress") || parent.dataset.active || 0);el!.dataset.equipment=equipmentNames[Math.max(0,Math.min(2,Math.round(progress)))];groups.forEach((g,i)=>{const d=i-progress;g.position.set(d*6.4,.18*Math.sin(time*.7+i),-Math.abs(d)*4.6-1.2);g.scale.setScalar(Math.max(.1,1-.26*Math.min(Math.abs(d),1.6))*1.45*(i===2?.86:1));g.rotation.set(.1*Math.sin(time*.3+i)+d*.12,d*.42+Math.sin(time*.25+i)*.2+px*.2,g.userData.restZ);});}
    else if(variant==="physics"){
     const progress=Number(parent.style.getPropertyValue("--support-progress") || 0),appear=1;
     const breakT=Number(parent.style.getPropertyValue("--support-break") || 0);
     finale!.update(time,appear,breakT);el!.dataset.phase=breakT<.05?"assembled":breakT<.55?"shattering":breakT<.86?"particles":"cleared";
     if(bloom){const range=(v:number,a:number,b:number)=>Math.max(0,Math.min(1,(v-a)/(b-a)));bloom.strength=.55+(.25+.5*range(progress,2.1,2.7))*range(progress,0,.6)*(1-range(progress,3,3.6));}
    }
    else {groups[0].rotation.set(.45+py*.2,.3+px*.2,time*.07);groups[0].children.forEach((m,i)=>{m.rotation.x=i*.075+Math.sin(time*.35+i*.3)*.3;m.rotation.y=Math.cos(time*.28+i*.22)*.28;});}
    camera.position.x+=(px*.6-camera.position.x)*Math.min(1,dt*5);camera.position.y+=(py*.4-camera.position.y)*Math.min(1,dt*5);camera.lookAt(0,0,0);if(composer)composer.render();else renderer.render(scene,camera);
   };const resize=()=>{renderer.setSize(el!.clientWidth,el!.clientHeight);camera.aspect=el!.clientWidth/el!.clientHeight;camera.fov=variant==="physics"?Math.min(62,34*Math.pow(Math.max(1,1.2/camera.aspect),.55)):camera.aspect<1?48:34;camera.updateProjectionMatrix();composer?.setSize(el!.clientWidth,el!.clientHeight);};const ro=new ResizeObserver(resize);ro.observe(el!);resize();raf=requestAnimationFrame(tick);setReady(true);
   const lost=()=>{setReady(false);visible=false;};renderer.domElement.addEventListener("webglcontextlost",lost);
   dispose=()=>{cancelAnimationFrame(raf);ro.disconnect();parent.removeEventListener("pointermove",pointer);parent.removeEventListener("pointerleave",leave);const geometries=new Set(geometry),usedMaterials=new Set<THREE.Material>([...Object.values(materials),glass,chrome,medicalSteel,medicalGlass]);scene.traverse(node=>{if(node instanceof THREE.Mesh || node instanceof THREE.Points){geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])usedMaterials.add(material);}});geometries.forEach(g=>g.dispose());usedMaterials.forEach(m=>m.dispose());environment.dispose();bloom?.dispose();output?.dispose();composer?.dispose();renderer.dispose();renderer.domElement.remove();setReady(false);};
  }
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;mount();},{rootMargin:"200px"});observer.observe(el);
  const change=()=>{if(reduce.matches){dispose?.();dispose=undefined;}else mount();};reduce.addEventListener("change",change);
  return()=>{observer.disconnect();reduce.removeEventListener("change",change);dispose?.();};
 },[variant]);
 return <div ref={host} className={`chapter-scene chapter-scene-${variant}${ready?" is-ready":""}`} aria-hidden="true"><div className="chapter-scene-fallback">{variant==="rings"?Array.from({length:8},(_,i)=><i key={i} style={{rotate:`${i*15}deg`,scale:1+i*.08}}/>):variant==="physics"?<div className="finale-static"><i/><i/><i/><i/><i/><i/><span/></div>:<MedicalFallback/>}</div></div>;
}
