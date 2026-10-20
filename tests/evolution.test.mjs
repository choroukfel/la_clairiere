import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { if (x && typeof x === 'object') { this.x=x.x; this.y=x.y; } else { this.x=x; this.y=y; } return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x+=v.x; this.y+=v.y; return this; }
  sub(v) { this.x-=v.x; this.y-=v.y; return this; }
  mult(n) { this.x*=n; this.y*=n; return this; }
  div(n) { this.x/=n; this.y/=n; return this; }
  magSq() { return this.x*this.x+this.y*this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const m=this.mag(); if(m) this.div(m); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { if(this.magSq()>n*n) this.setMag(n); return this; }
  heading() { return Math.atan2(this.y,this.x); }
  dot(v) { return this.x*v.x+this.y*v.y; }
  static sub(a,b) { return new Vector(a.x-b.x,a.y-b.y); }
  static add(a,b) { return new Vector(a.x+b.x,a.y+b.y); }
  static dist(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
  static fromAngle(a) { return new Vector(Math.cos(a),Math.sin(a)); }
}
function context() {
  const draw = ['push','pop','translate','rotate','noStroke','fill','triangle','stroke','strokeWeight','line','circle','ellipse','rect','beginShape','vertex','endShape','noFill'];
  const c = vm.createContext({
    ...Object.fromEntries(draw.map(k=>[k,()=>{}])),
    createVector:(x=0,y=0)=>new Vector(x,y), p5:{Vector}, width:800,height:600,
    TWO_PI:Math.PI*2, HALF_PI:Math.PI/2, PI:Math.PI,
    random(a,b) { if(Array.isArray(a)) return a[0]; if(a===undefined) return 0.5; if(b===undefined) return Math.random()*a; return a+Math.random()*(b-a); },
    constrain:(v,min,max)=>Math.max(min,Math.min(max,v)),
  });
  for(const file of ['vehicle.js','steeringBehaviors.js','evolution.js','geneticRocket.js','sensorRay.js']) vm.runInContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),c,{filename:file});
  return vm.runInContext('({Vehicle, SteeringBehaviors, SteeringDNA, EvolutionManager, TrajectoryDNA, GeneticRocket, GeneticPopulation, NeuralNetwork, SensorRay})',c);
}

test('projection scalaire : projection intérieure et projection bornée aux extrémités',()=>{
  const {SteeringBehaviors}=context();
  const a=new Vector(0,0), b=new Vector(10,0);
  assert.deepEqual([SteeringBehaviors.projectOnSegment(new Vector(4,3),a,b).t, SteeringBehaviors.projectOnSegment(new Vector(4,3),a,b).point.y],[0.4,0]);
  assert.equal(SteeringBehaviors.projectOnSegment(new Vector(20,3),a,b).t,1);
});

test('ADN steering : bornes, croisement et mutation',()=>{
  const {SteeringDNA}=context();
  const a=new SteeringDNA({fearWeight:1,separationWeight:1,cohesionWeight:.2,perceptionRadius:150,escapeSpeed:3});
  const b=new SteeringDNA({fearWeight:2,separationWeight:2,cohesionWeight:.8,perceptionRadius:250,escapeSpeed:5});
  const child=a.crossover(b).mutate(1);
  assert.ok(child.genes.fearWeight>=0 && child.genes.fearWeight<=3.5);
  assert.ok(child.genes.perceptionRadius>=60 && child.genes.perceptionRadius<=300);
  assert.ok(child.genes.escapeSpeed>=1 && child.genes.escapeSpeed<=6);
});

test('missiles génétiques : entités Vehicle ; le capteur à rayon est une perception',()=>{
  const {Vehicle, GeneticRocket, SensorRay}=context();
  assert.ok(new GeneticRocket(20,30) instanceof Vehicle);
  assert.ok(!(new SensorRay(0.5,100) instanceof Vehicle));
});

test('capteur à rayon : part du porteur dans le sens de sa vitesse, sans le déplacer',()=>{
  const {SensorRay,Vehicle}=context();
  const walker=new Vehicle(100,300);
  walker.vel.set(2,0);
  const ray=new SensorRay(0,100);
  assert.equal(ray.sense(walker,[]),1,'rien devant : distance maximale');
  assert.equal(ray.hit,false);
  assert.equal(ray.proximity(),0);
  const rock={pos:new Vector(160,300),r:10};
  const reading=ray.sense(walker,[rock]);
  assert.ok(ray.hit && reading<1);
  assert.equal(ray.hitDistance,54,'premier pas de 6 px dans le disque de rayon 10 centré à 60 px');
  assert.ok(Math.abs(ray.proximity()-0.46)<1e-9);
  assert.deepEqual([walker.pos.x,walker.pos.y,walker.vel.x,walker.vel.y],[100,300,2,0],'le porteur n’est pas déplacé');
  // rayon à 90° : vers le bas pour un porteur qui va vers la droite
  const side=new SensorRay(Math.PI/2,100);
  side.sense(walker,[{pos:new Vector(100,340),r:10}]);
  assert.ok(side.hit && side.hitDistance===36,'pas de 6 px : à 30 px on est au bord du disque, à 36 px dedans');
  // scène non bornée : le bord ne compte pas
  const edge=new Vehicle(790,300);
  edge.vel.set(1,0);
  assert.equal(new SensorRay(0,100).sense(edge,[],{bounded:false}),1);
  assert.ok(new SensorRay(0,100).sense(edge,[])<1,'scène bornée : le bord est un danger');
});

test('réseau neuronal : sorties bornées et dimensions attendues',()=>{
  const {NeuralNetwork}=context();
  const network=new NeuralNetwork();
  const output=network.forward([.2,.7,.4,-.1]);
  assert.equal(output.length,2);
  assert.ok(output.every(value=>value>=-1 && value<=1));
  assert.doesNotThrow(()=>network.crossover(new NeuralNetwork()).mutate(.2));
});

test('population génétique initialisée avec un nombre fixe d’agents',()=>{
  const {GeneticPopulation}=context();
  const rockets=new GeneticPopulation({size:8,lifetime:4});
  assert.equal(rockets.rockets.length,8);
  assert.ok(rockets.rockets.every(rocket=>rocket.dna.genes.length===210));
});
