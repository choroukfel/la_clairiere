// Banc d'essai sans navigateur pour les esprits neuronaux : il charge les vrais
// modules du jeu (vehicle.js, steering, FleeTarget, SeekVehicle…) dans un contexte vm,
// avec un aléatoire reproductible et une horloge simulée, puis fait tourner une arène
// réduite (veilleurs, esprits, luciole scriptée, obstacles, refuges).
// Utilisé par tests/neural-spirits.test.mjs et tools/train-spirits.mjs.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { if (x && typeof x === 'object') { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const m = this.mag(); if (m) this.div(m); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { if (this.magSq() > n * n) this.setMag(n); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); return this.set(this.x * c - this.y * s, this.x * s + this.y * c); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static mult(a, n) { return new Vector(a.x * n, a.y * n); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static fromAngle(a) { return new Vector(Math.cos(a), Math.sin(a)); }
  static lerp(a, b, t) { return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
}

// Générateur pseudo-aléatoire reproductible (mulberry32).
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILES = [
  'vehicle.js', 'population.js', 'obstacle.js', 'sanctuary.js', 'steeringBehaviors.js', 'evolution.js',
  'geneticRocket.js', 'migratingWisp.js', 'wispNest.js', 'wispMigration.js',
  'soundCall.js', 'spiritEscape.js', 'fleeTarget.js', 'seekVehicle.js', 'sensorRay.js', 'neuralSteeringDNA.js', 'spiritBrainPool.js', 'neuralSpirit.js',
  'followerSpirit.js', 'clapDetector.js', 'soundEffects.js',
];
const EXPORTS = `({ Vehicle, SeekPopulation, Obstacle, Sanctuary, SteeringBehaviors, SteeringDNA, EvolutionManager,
  NeuralNetwork, SpiritEscape, SoundCall, FleeTarget, SeekVehicle, SPIRIT_BRAIN, NeuralSteeringDNA, SpiritBrainPool, NeuralSpirit,
  FollowerSpirit, ClapDetector, SoundEffects, GeneticRocket, GeneticPopulation, TrajectoryDNA, MigratingWisp, WispNest, WispMigration })`;

// pretrained : charge aussi spiritBrainPretrained.js s'il existe.
export function loadSpirits({ seed = 1, width = 1000, height = 700, pretrained = false } = {}) {
  const rng = seededRng(seed);
  const clock = { now: 1000 };
  const context = vm.createContext({
    createVector: (x = 0, y = 0) => new Vector(x, y),
    p5: { Vector },
    width, height,
    TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, PI: Math.PI,
    random(a, b) {
      if (Array.isArray(a)) return a[Math.floor(rng() * a.length)];
      if (a === undefined) return rng();
      if (b === undefined) return rng() * a;
      return a + rng() * (b - a);
    },
    constrain: (v, min, max) => Math.max(min, Math.min(max, v)),
    millis: () => clock.now,
    console,
  });
  const files = [...FILES];
  const pretrainedUrl = new URL('../spiritBrainPretrained.js', import.meta.url);
  if (pretrained && existsSync(pretrainedUrl)) files.push('spiritBrainPretrained.js');
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  const g = vm.runInContext(EXPORTS, context);
  g.PRETRAINED_SPIRIT_BRAINS = vm.runInContext('typeof PRETRAINED_SPIRIT_BRAINS === "undefined" ? null : PRETRAINED_SPIRIT_BRAINS', context);
  return { g, rng, clock, width, height };
}

// Arène réduite fidèle aux règles du jeu (sceneController.js) : sauvetage au contact de la luciole,
// capture dans le cercle de détection, refuge qui repousse les veilleurs.
// neural : esprits NeuralSpirit nés de pool.breed() ; sinon FleeTarget classiques.
// learn : les esprits qui quittent l'arène enrichissent le réservoir.
export function runArena(env, { minutes = 10, spirits = 8, watchers = 3, neural = true, pool = null, learn = true,
  sanctuaryEveryMs = 20000, playerSpeed = 3.5 } = {}) {
  const { g, rng, clock, width, height } = env;
  const brainPool = pool ?? new g.SpiritBrainPool();
  const obstacles = [];
  for (let i = 0; i < 6; i++) obstacles.push(new g.Obstacle(80 + rng() * (width - 160), 80 + rng() * (height - 160), 22 + rng() * 16));
  const path = [new Vector(150, 150), new Vector(width - 150, 150), new Vector(width - 150, height - 150), new Vector(150, height - 150)];
  const player = new g.FleeTarget(width / 2, height / 2, 1.4, true);
  player.setManualSpeed(playerSpeed);
  const guards = Array.from({ length: watchers }, (_, i) => new g.SeekVehicle(path[i % 4].x, path[i % 4].y, { kind: 'moth', speedMultiplier: 1 }));
  const sanctuaries = [];
  const stats = { rescued: 0, caught: 0, threatenedSeconds: 0 };

  const spawn = () => {
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = 40 + rng() * (width - 80);
      y = 40 + rng() * (height - 80);
      const clear = guards.every(guard => Math.hypot(guard.pos.x - x, guard.pos.y - y) > 220)
        && Math.hypot(player.pos.x - x, player.pos.y - y) > 120
        && obstacles.every(obstacle => Math.hypot(obstacle.pos.x - x, obstacle.pos.y - y) > obstacle.r + 14);
      if (clear) break;
    }
    return neural ? new g.NeuralSpirit(x, y, 1.4, false, brainPool.breed()) : new g.FleeTarget(x, y, 1.4, false);
  };
  const wild = Array.from({ length: spirits }, spawn);
  const leave = (spirit, rescued) => {
    if (rescued) stats.rescued++; else stats.caught++;
    stats.threatenedSeconds += (spirit.threatenedMs ?? 0) / 1000;
    if (learn) brainPool.record(spirit, rescued);
    wild.splice(wild.indexOf(spirit), 1, spawn());
  };

  const frames = Math.round(minutes * 60 * 60);
  let nextBloom = clock.now + sanctuaryEveryMs;
  for (let frame = 0; frame < frames; frame++) {
    clock.now += 1000 / 60;
    const now = clock.now;
    if (now >= nextBloom) {
      sanctuaries.push(new g.Sanctuary(player.pos.x, player.pos.y, now));
      nextBloom = now + sanctuaryEveryMs;
    }
    for (let i = sanctuaries.length - 1; i >= 0; i--) if (sanctuaries[i].isExpired(now)) sanctuaries.splice(i, 1);

    // luciole scriptée : va vers l'esprit le plus menacé, sinon vers le plus proche
    let goal = null;
    let best = -Infinity;
    for (const spirit of wild) {
      const score = (spirit.threatLevel ?? 0) * 1000 - Math.hypot(spirit.pos.x - player.pos.x, spirit.pos.y - player.pos.y);
      if (score > best) { best = score; goal = spirit.pos; }
    }
    // même ordre que sceneController.js : think puis steer pour chaque cible, sauvetages,
    // puis une seule locomotion par cible
    const playerContext = { pointerGoal: goal ? goal.copy() : null, obstacles };
    player.think([], now, playerContext);
    player.steer(playerContext);

    for (const spirit of [...wild]) {
      const pickup = player.r + spirit.r + 8;
      if (Vector.dist(player.pos, spirit.pos) <= pickup) leave(spirit, true);
    }
    for (const spirit of [...wild]) {
      const context = { neighbors: wild, obstacles, player, sanctuaries };
      if (spirit.think(guards, now, context)) { leave(spirit, false); continue; }
      spirit.steer(context);
    }
    for (const entity of [player, ...wild]) {
      entity.update();
      entity.edges();
    }
    for (const guard of guards) {
      const target = guard.chooseBehaviorTarget([player, ...wild], now, 1, obstacles);
      if (target && !target.memoryTarget) {
        g.SeekPopulation.step(guard, target, width, height, rng, obstacles, sanctuaries, path);
      } else {
        guard.applyBehaviors(target, obstacles, sanctuaries, path);
        guard.update();
        guard.edges();
        if (target?.memoryTarget && Vector.dist(guard.pos, target.pos) <= guard.investigationRadius) {
          guard.aiState = 'patrol';
          guard.lastKnownPosition = null;
        }
      }
    }
  }
  const total = stats.rescued + stats.caught;
  return { ...stats, rescueRate: total ? stats.rescued / total : 0, pool: brainPool, wild, guards, player };
}
