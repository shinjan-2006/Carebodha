import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Equipment } from "./equipment-catalog";
type Materials = { chrome: THREE.Material; glass: THREE.Material; blue: THREE.Material; white: THREE.Material; ink: THREE.Material; screen: THREE.Material };

/** Code-built equipment: no external models, images, patient readings, or loading requests. */
export function createMedicalEquipment(kind: Equipment, materials: Materials) {
  const group = new THREE.Group();
  group.name = kind;
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x=0, y=0, z=0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    group.add(object);
    return object;
  }
  function tube(points: number[][], radius: number, material: THREE.Material) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))), 56, radius, 8, false), material);
  }
  function box(w:number, h:number, d:number, radius:number, material:THREE.Material, x=0, y=0, z=0) {
    return mesh(new RoundedBoxGeometry(w,h,d,2,radius),material,x,y,z);
  }
  function disc(radius:number, depth:number, material:THREE.Material, x:number,y:number,z:number) {
    const object=mesh(new THREE.CylinderGeometry(radius,radius,depth,40),material,x,y,z);
    object.rotation.x=Math.PI/2;
    return object;
  }
  if(kind==="stethoscope") {
    // Binaural metal arms, soft ear tips, a continuous rubber loop, and a chestpiece.
    for(const sign of [-1,1]) {
      tube([[sign*.18,.26,0],[sign*.65,.75,0],[sign*.78,1.45,0],[sign*.5,1.85,.03]],.055,materials.chrome);
      const tip=mesh(new THREE.SphereGeometry(.11,16,12),materials.ink,sign*.48,1.86,.04);
      tip.scale.set(.85,1.35,.85);tip.rotation.z=sign*.6;
    }
    tube([[-.18,.28,0],[0,-.05,0],[.02,-1.12,0],[.46,-1.65,.04],[1.1,-1.35,.1],[1.14,-.48,.1],[.88,-.15,.14]],.105,materials.blue);
    box(.28,.3,.2,.07,materials.blue,0,.19,0);
    tube([[.88,-.15,.14],[.82,.02,.18],[.85,.2,.21]],.065,materials.chrome);
    disc(.43,.14,materials.chrome,.84,.35,.25);
    disc(.34,.035,materials.white,.84,.35,.34);
    mesh(new THREE.TorusGeometry(.38,.025,8,48),materials.chrome,.84,.35,.37);
    group.rotation.z=-.16;
  } else if(kind==="blood-pressure") {
    box(1.75,1.55,.72,.22,materials.white,.28,.15,0);
    box(1.45,.86,.04,.09,materials.ink,.28,.4,.38);
    box(1.3,.72,.035,.07,materials.screen,.28,.4,.41);
    // Unmeasured display, deliberately no invented patient measurement.
    for(const row of [0,1])for(const x of [-.17,.17])box(.24,.065,.02,.025,materials.ink,.28+x,.55-row*.29,.44);
    for(const x of [-.16,.13,.41])disc(.075,.045,x===.41?materials.blue:materials.chrome,x,-.34,.4);
    box(.43,.11,.035,.04,materials.blue,.66,-.37,.4);
    const cuff=mesh(new THREE.CylinderGeometry(.55,.55,1.23,32,1,true),materials.blue,-1.4,-.36,.12);
    cuff.rotation.z=.27;
    const liner=mesh(new THREE.CylinderGeometry(.49,.49,1.2,32,1,true),materials.ink,-1.4,-.36,.12);
    liner.rotation.z=.27;
    box(.58,.4,.12,.05,materials.white,-1.48,-.33,.63).rotation.z=.27;
    tube([[-.62,-.32,.1],[-.72,-.72,.18],[-.75,-1.14,.15],[-1.35,-1.34,.1],[-1.63,-.83,.12]],.045,materials.ink);
    group.rotation.z=-.08;
  } else {
    mesh(new THREE.CylinderGeometry(.045,.045,3.9,16),materials.chrome,-.35,.1,0);
    mesh(new THREE.CylinderGeometry(.075,.075,1.65,16),materials.chrome,-.35,-1.03,0);
    disc(.12,.09,materials.blue,-.35,-.45,.07);
    tube([[-.35,2.05,0],[.06,2.1,0],[.38,2.07,0],[.53,1.84,0]],.04,materials.chrome);
    box(1.06,1.46,.28,.17,materials.glass,.54,.97,.02);
    box(.92,.63,.21,.1,materials.screen,.54,.59,.03);
    box(.67,.44,.035,.025,materials.white,.54,1.12,.18);
    box(.33,.035,.02,.01,materials.blue,.54,1.2,.21);
    box(.33,.035,.02,.01,materials.chrome,.54,1.07,.21);
    tube([[.54,.24,.03],[.54,-.12,.03],[.74,-.55,.06],[.8,-1.45,.05],[.58,-1.64,.05]],.024,materials.chrome);
    box(.16,.38,.14,.05,materials.glass,.54,-.03,.03);
    box(.13,.27,.1,.025,materials.blue,.78,-.83,.09);
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3;
      const x=-.35+Math.cos(a)*.87,z=Math.sin(a)*.87;
      tube([[-.35,-1.83,0],[x,-1.96,z]],.045,materials.chrome);
      const wheel=mesh(new THREE.CylinderGeometry(.13,.13,.1,16),materials.ink,x,-2.03,z);
      wheel.rotation.z=Math.PI/2;
    }
    group.scale.setScalar(.86);
    group.rotation.z=.04;
  }
  return group;
}
