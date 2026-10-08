"use client";
import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {mergeVertices} from "three/addons/utils/BufferGeometryUtils.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {RibbonFallback} from "./ribbon-fallback";

// Adapted from the public MATTER preview's bladeGeometry and Sculpture.
// Native scrolling is retained and the sculpture is limited to the landing hero.
function bladeGeometry() {
  const w=1.15,h=.32,r=.07,x=-w/2,y=-h/2,s=new THREE.Shape();
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.absarc(x+w-r,y+r,r,-Math.PI/2,0);
  s.lineTo(x+w,y+h-r);s.absarc(x+w-r,y+h-r,r,0,Math.PI/2);
  s.lineTo(x+r,y+h);s.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI);
  s.lineTo(x,y+r);s.absarc(x+r,y+r,r,Math.PI,Math.PI*1.5);
  const raw=new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.016,bevelSegments:2,curveSegments:6});
  const geo=mergeVertices(raw,1e-4);raw.dispose();geo.center();
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.06*Math.pow(p.getX(i)/(w/2),2)-.03);
  geo.computeVertexNormals();return geo;
}
export function ChromeScene() {
  const host=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false);
  useEffect(()=>{
      const el=host.current;if(!el)return;
    const hero=el.closest<HTMLElement>(".hero");
    const stage=el.closest<HTMLElement>(".hero-stage");
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");
    let disposeScene:(()=>void)|undefined;
    function mount() {
      disposeScene?.();disposeScene=undefined;setReady(false);
      stage?.removeAttribute("data-scene");
      if(reduce.matches)return;
      let renderer:THREE.WebGLRenderer;
      try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});}catch{if(stage)stage.dataset.scene="fallback";return;}
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      renderer.transmissionResolutionScale=.6;
      el!.appendChild(renderer.domElement);
      const scene=new THREE.Scene(),background=new THREE.Color("#e4e3df"),pearl=background.clone(),black=new THREE.Color("#0a0a0b");scene.background=background;
      const camera=new THREE.PerspectiveCamera(34,1,.1,220);camera.position.set(0,0,14);
      const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
      const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
      const glass=new THREE.MeshPhysicalMaterial({color:"#f1f3ff",metalness:0,roughness:.05,transmission:1,thickness:.45,ior:1.46,clearcoat:1,clearcoatRoughness:.03,iridescence:.85,iridescenceIOR:1.32,iridescenceThicknessRange:[120,560],attenuationColor:new THREE.Color("#aebbff"),attenuationDistance:1.1,envMapIntensity:1.2});
      const chrome=new THREE.MeshPhysicalMaterial({color:"#eef0f5",metalness:1,roughness:.08,envMapIntensity:1.3,clearcoat:.3});
      const geo=bladeGeometry(),along=el!.clientWidth<700?58:100,strands=6;
      const glasses=new THREE.InstancedMesh(geo,glass,along*5),chromes=new THREE.InstancedMesh(geo,chrome,along);
      glasses.frustumCulled=chromes.frustumCulled=false;scene.add(glasses,chromes);
      const key=new THREE.DirectionalLight("#ffffff",1.3),rim=new THREE.DirectionalLight("#bfd0ff",.9),fill=new THREE.DirectionalLight("#ffffff",.35);key.position.set(4,8,6);rim.position.set(-7,3,-3);fill.position.set(-3,-4,5);scene.add(key,rim,fill);
      const dummy=new THREE.Object3D(),P=new THREE.Vector3(),A=new THREE.Vector3(),B=new THREE.Vector3(),T=new THREE.Vector3(),W=new THREE.Vector3(),N=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1),X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),basis=new THREE.Matrix4(),q=new THREE.Quaternion();
      let frame=0,active=true,time=0,last=0,pointerX=0,pointerY=0,pointerActive=false;
      const count=along*strands,displacement=new Float32Array(count*3),velocity=new Float32Array(count*3),rotation=new Float32Array(count),rotationVelocity=new Float32Array(count);
      const lerp=(a:number,b:number,t:number)=>a+(b-a)*t,range=(v:number,a:number,b:number)=>Math.max(0,Math.min(1,(v-a)/(b-a))),smooth=(t:number)=>t*t*(3-2*t),ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      const hash=(i:number)=>{const n=Math.sin(i*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
      const grid=new THREE.Vector3(),gridQuaternion=new THREE.Quaternion(),cardQuaternion=new THREE.Quaternion().setFromAxisAngle(Z,Math.PI/2),identityQuaternion=new THREE.Quaternion(),ndc=new THREE.Vector3(),ray=new THREE.Vector3(),hit=new THREE.Vector3();
      let cameraX=0,cameraY=0;
      const spine=(s:number,t:number,v:THREE.Vector3)=>v.set(-13+26*s,7.4-14.8*s+1.6*Math.sin(s*6.283+t*.22),2.5-7.5*s+1.2*Math.sin(s*9.4-t*.17));
      function render(now:number){
        frame=requestAnimationFrame(render);const dt=Math.min((now-last)/1000,1/30);last=now;if(!active || document.hidden)return;time+=dt;
        const p=Number(hero?.dataset.progress || 0),scrollVelocity=Number(hero?.dataset.velocity || 0);
        const expand=ease(range(p,0,1.3)),gridProgress=range(p,1.3,2.6),spread=smooth(range(p,2.6,4)),lum=smooth(range(p,2.8,3.6)),dark=smooth(range(p,2.7,3.45));
        background.copy(pearl).lerp(black,dark);
        scene.environmentIntensity=1-.78*dark;key.intensity=1.3-1.15*dark;rim.intensity=.9-.7*dark;fill.intensity=.35-.3*dark;
        glass.emissive.set("#6a5cff");glass.emissiveIntensity=lum*.9;chrome.emissive.set("#7a6dff");chrome.emissiveIntensity=lum*.35;
        const baseZ=14;
        cameraX+=(pointerActive?pointerX*.35-cameraX:-cameraX)*(1-Math.exp(-5*dt));cameraY+=(pointerActive?pointerY*.21-cameraY:-cameraY)*(1-Math.exp(-5*dt));
        const cz=baseZ-5*expand-13*ease(range(p,2.6,4))-6*range(p,4,7),cx=1.3*Math.sin(range(p,0,1.3)*Math.PI);
        camera.position.set(cx+cameraX,cameraY,cz);camera.lookAt(cameraX*.4,cameraY*.4,cz-12);
        if(pointerActive){ndc.set(pointerX*2,pointerY*2,.5).unproject(camera);ray.copy(ndc).sub(camera.position).normalize();}
        const bend=1+Math.min(Math.abs(scrollVelocity)*.28,.7);
        let gi=0,ci=0;
        for(let j=0;j<along;j++)for(let k=0;k<strands;k++){
          const s=(j+.5)/along;spine(s,time,P);spine(s+.008,time,A);spine(s-.008,time,B);
          T.subVectors(A,B).normalize();W.crossVectors(T,Z).normalize();N.crossVectors(W,T).normalize();
          const i=j*strands+k,i3=i*3;
          dummy.position.copy(P).addScaledVector(W,(k-2.5)*(.44+.75*expand)).addScaledVector(N,.3*Math.sin(time*.8+s*6.3+k*.55)*(1+expand*.8));
          basis.makeBasis(W,T,N);dummy.quaternion.setFromRotationMatrix(basis);
          q.setFromAxisAngle(X,(.62*Math.sin(s*11-time*.9+k*.7)+.32*Math.sin(s*27+time*.5+k*.3))*bend*(1+expand*.9));dummy.quaternion.multiply(q);
          q.setFromAxisAngle(Y,.24*Math.sin(s*5+time*.4+k*1.1)*(1+expand));dummy.quaternion.multiply(q);
          const stagger=hash(i*13+5),w=smooth(range(gridProgress,stagger*.55,stagger*.55+.45)),isCard=hash(i*3+11)<.16;
          if(w>0){
            const cols=el!.clientWidth<700?16:30,rows=Math.ceil(count/cols);
            grid.set(((i%cols)-(cols-1)/2)*1.35,((rows-1)/2-Math.floor(i/cols))*1.25+.06*Math.sin(time*1.2+i),(-2-hash(i*17+2)*30)*spread);
            grid.x+=spread*1.2*Math.sin(time*.13+i*1.7);grid.y+=spread*.8*Math.sin(time*.11+i*2.3);dummy.position.lerp(grid,w);
            gridQuaternion.copy(isCard?cardQuaternion:identityQuaternion);
            if(spread>0){q.setFromAxisAngle(Y,spread*(hash(i+1)-.5)*1.8+time*.06*(hash(i*7+3)-.5));gridQuaternion.multiply(q);}
            dummy.quaternion.slerp(gridQuaternion,w);
          }
          let fx=0,fy=0,fz=0,tq=0;
          if(pointerActive && Math.abs(ray.z)>1e-4){const distance=(dummy.position.z-camera.position.z)/ray.z;if(distance>0){hit.copy(camera.position).addScaledVector(ray,distance);const dx=dummy.position.x-hit.x,dy=dummy.position.y-hit.y,d=Math.hypot(dx,dy);if(d<2.4 && d>1e-4){const f=Math.pow(1-d/2.4,2)*7;fx=dx/d*f;fy=dy/d*f;fz=f*.35;tq=f*.24*(dx>=0?1:-1);}}}
          for(let c=0;c<3;c++){const force=c===0?fx:c===1?fy:fz;velocity[i3+c]+=(-90*displacement[i3+c]-11*velocity[i3+c]+force)*dt;displacement[i3+c]+=velocity[i3+c]*dt;}
          rotationVelocity[i]+=(-70*rotation[i]-9*rotationVelocity[i]+tq)*dt;rotation[i]+=rotationVelocity[i]*dt;
          dummy.position.x+=displacement[i3];dummy.position.y+=displacement[i3+1];dummy.position.z+=displacement[i3+2];q.setFromAxisAngle(X,rotation[i]);dummy.quaternion.multiply(q);
          dummy.scale.setScalar(lerp(1,isCard?1:.95,w));dummy.updateMatrix();
          (k===2?chromes:glasses).setMatrixAt(k===2?ci++:gi++,dummy.matrix);
        }
        glasses.instanceMatrix.needsUpdate=chromes.instanceMatrix.needsUpdate=true;
        renderer.render(scene,camera);
      }
      const resize=()=>{const w=el!.clientWidth,h=el!.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=Math.min(62,34*Math.pow(Math.max(1,1.2/camera.aspect),.55));camera.updateProjectionMatrix();};
      const pointer=(e:PointerEvent)=>{if(e.pointerType==="touch")return;const b=el!.getBoundingClientRect();pointerX=(e.clientX-b.left)/b.width-.5;pointerY=.5-(e.clientY-b.top)/b.height;pointerActive=true;};
      const leave=()=>{pointerActive=false;};
      const lost=(e:Event)=>{e.preventDefault();setReady(false);active=false;if(stage)stage.dataset.scene="fallback";};
      const observer=new IntersectionObserver(([entry])=>{active=entry.isIntersecting;});observer.observe(el!);
      const ro=new ResizeObserver(resize);ro.observe(el!);resize();
      hero?.addEventListener("pointermove",pointer,{passive:true});hero?.addEventListener("pointerleave",leave);renderer.domElement.addEventListener("webglcontextlost",lost);
      frame=requestAnimationFrame(render);setReady(true);
      disposeScene=()=>{cancelAnimationFrame(frame);observer.disconnect();ro.disconnect();hero?.removeEventListener("pointermove",pointer);hero?.removeEventListener("pointerleave",leave);renderer.domElement.removeEventListener("webglcontextlost",lost);geo.dispose();glass.dispose();chrome.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();};
    }
    mount();reduce.addEventListener("change",mount);
    return()=>{reduce.removeEventListener("change",mount);disposeScene?.();};
  },[]);
  return <div ref={host} className={`chrome-scene ${ready?"is-ready":""}`} aria-hidden="true"><RibbonFallback/></div>;
}
