import * as THREE from "three";

// Adapted directly from the public MATTER Finale export:
// https://www.aura.build/templates/matter-immersive
// Retains its 80 thick triangular faces, stagger, easing, core and particle breakup.
const range=(v:number,a:number,b:number)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
const smooth=(t:number)=>t*t*(3-2*t);
const easeOut=(t:number)=>1-Math.pow(1-t,3);
const hash=(i:number)=>{const s=Math.sin(i*12.9898+78.233)*43758.5453;return s-Math.floor(s);};

export function createMatterEnvironment(renderer:THREE.WebGLRenderer){
  const studio=new THREE.Scene(),geometry=new THREE.SphereGeometry(60,64,32);
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:"varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:`varying vec3 vP;void main(){
      vec3 d=normalize(vP);float u=atan(d.z,d.x);float v=d.y;
      vec3 col=mix(vec3(0.10,0.10,0.13),vec3(1.02,1.01,0.99),smoothstep(-0.55,0.85,v));
      col*=1.0-0.55*exp(-pow((v+0.05)/0.12,2.0));
      col+=vec3(1.0)*2.4*exp(-pow((v-0.62)/0.085,2.0));
      col+=vec3(1.0)*0.9*exp(-pow((v-0.14)/0.045,2.0))*(0.55+0.45*cos(u*3.0+0.6));
      col+=vec3(0.28,0.46,1.00)*1.1*exp(-pow((u-1.9)/0.65,2.0))*exp(-pow((v-0.02)/0.45,2.0));
      col+=vec3(0.58,0.34,1.00)*0.8*exp(-pow((u+1.7)/0.65,2.0))*exp(-pow((v+0.08)/0.45,2.0));
      col+=vec3(0.86,0.92,1.00)*0.16*exp(-pow((v+0.62)/0.22,2.0));gl_FragColor=vec4(col,1.0);
    }`});
  studio.add(new THREE.Mesh(geometry,material));const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.02);
  geometry.dispose();material.dispose();pmrem.dispose();return environment;
}

export function createMatterFinale(glass:THREE.MeshPhysicalMaterial,chrome:THREE.Material){
  const root=new THREE.Group(),ico=new THREE.IcosahedronGeometry(2.3,1),pos=ico.attributes.position;
  const material=glass.clone();material.emissive=new THREE.Color("#5b52ff");material.emissiveIntensity=.06;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const shards:{mesh:THREE.Mesh;center:THREE.Vector3;normal:THREE.Vector3;stagger:number;spin:THREE.Vector3;drift:THREE.Vector3}[]=[];
  for(let f=0;f<pos.count/3;f++){
    a.fromBufferAttribute(pos,f*3);b.fromBufferAttribute(pos,f*3+1);c.fromBufferAttribute(pos,f*3+2);
    const center=new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1/3),normal=center.clone().normalize();
    const tri=[a,b,c,a.clone().addScaledVector(normal,-.09),b.clone().addScaledVector(normal,-.09),c.clone().addScaledVector(normal,-.09)].map(v=>v.clone().sub(center));
    const verts=[tri[0],tri[1],tri[2],tri[5],tri[4],tri[3],tri[0],tri[3],tri[1],tri[1],tri[3],tri[4],tri[1],tri[4],tri[2],tri[2],tri[4],tri[5],tri[2],tri[5],tri[0],tri[0],tri[5],tri[3]];
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts.flatMap(v=>[v.x,v.y,v.z]),3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(center);root.add(mesh);
    shards.push({mesh,center,normal,stagger:hash(f*7+1),spin:new THREE.Vector3(hash(f*3)-.5,hash(f*5)-.5,hash(f*11)-.5).multiplyScalar(4),drift:new THREE.Vector3(hash(f*13)-.5,hash(f*17)-.5,hash(f*19)-.5).multiplyScalar(2.2)});
  }
  ico.dispose();
  const core=new THREE.Mesh(new THREE.SphereGeometry(1.05,64,40),chrome);root.add(core);
  const count=shards.length*6,base=new Float32Array(count*3),directions=new Float32Array(count*3),positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const shard=shards[Math.floor(i/6)],j=i%6,r=.5*hash(i*3+2),angle=j/6*6.283+hash(i),n=i*3;
    base[n]=shard.center.x+Math.cos(angle)*r;base[n+1]=shard.center.y+Math.sin(angle)*r;base[n+2]=shard.center.z+(hash(i*5)-.5)*r;
    directions[n]=shard.normal.x+hash(i*7)-.5;directions[n+1]=shard.normal.y+hash(i*11)-.5+.3;directions[n+2]=shard.normal.z+hash(i*13)-.5;
  }
  const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const points=new THREE.Points(pg,new THREE.PointsMaterial({color:0xcfcaff,size:.05,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(points);
  const light=new THREE.PointLight(0x6f66ff,0,24,1.8);root.add(light);
  return {root,update(t:number,appear:number,breakT:number){
    root.visible=appear>0;if(!root.visible)return;
    const arrival=easeOut(appear);root.rotation.set(Math.sin(t*.19)*.22,t*.22,Math.sin(t*.13)*.1);root.scale.setScalar(.6+.4*arrival);
    light.intensity=1.6*arrival*(1-range(breakT,.7,1));material.emissiveIntensity=.06+.9*smooth(range(breakT,.05,.6));
    for(const shard of shards){
      const e=easeOut(range(breakT,shard.stagger*.45,shard.stagger*.45+.55));
      shard.mesh.position.copy(shard.center).addScaledVector(shard.normal,e*3).addScaledVector(shard.drift,e*e*.6);
      shard.mesh.rotation.set(shard.spin.x*e,shard.spin.y*e,shard.spin.z*e);
      shard.mesh.scale.setScalar(Math.max(.0001,1-smooth(range(breakT,.4,.92))*(1-.0001)));
    }
    core.scale.setScalar(Math.max(.0001,1-smooth(range(breakT,.5,.85))));
    const pin=smooth(range(breakT,.55,.85)),pout=smooth(range(breakT,.86,1));points.material.opacity=pin*(1-pout)*.95;points.material.size=.05+.06*pin;
    if(pin>0){const k=Math.pow(range(breakT,.6,1),3)*7;for(let i=0;i<count*3;i++)positions[i]=base[i]+directions[i]*k;pg.attributes.position.needsUpdate=true;}
  }};
}
