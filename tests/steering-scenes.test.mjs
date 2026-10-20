import test from 'node:test';
import { gameSource, GAME_MODULES } from './gameSource.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) {
    if (x && typeof x === 'object') return this.set(x.x, x.y);
    this.x = x; this.y = y; return this;
  }
  copy() { return new Vector(this.x, this.y); }
  add(vector) { this.x += vector.x; this.y += vector.y; return this; }
  sub(vector) { this.x -= vector.x; this.y -= vector.y; return this; }
  mult(amount) { this.x *= amount; this.y *= amount; return this; }
  div(amount) { this.x /= amount; this.y /= amount; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const magnitude = this.mag(); return magnitude ? this.div(magnitude) : this; }
  setMag(amount) { return this.normalize().mult(amount); }
  limit(maximum) { if (this.magSq() > maximum * maximum) this.setMag(maximum); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  dot(vector) { return this.x * vector.x + this.y * vector.y; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static fromAngle(angle) { return new Vector(Math.cos(angle), Math.sin(angle)); }
}

function makeScene() {
  const drawingFunctions = [
    'background', 'noStroke', 'fill', 'ellipse', 'circle', 'stroke', 'strokeWeight', 'line',
    'arc', 'rect', 'triangle', 'push', 'pop', 'translate', 'rotate', 'noFill', 'beginShape',
    'vertex', 'endShape', 'bezier',
  ];
  const drawingStubs = Object.fromEntries(drawingFunctions.map(name => [name, () => {}]));
  const context = vm.createContext({
    ...drawingStubs,
    color: (...values) => values,
    CLOSE: 1,
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    width: 800,
    height: 600,
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    HALF_PI: Math.PI / 2,
    random(first, second) {
      if (Array.isArray(first)) return first[0];
      if (second === undefined) return first * 0.5;
      return (first + second) * 0.5;
    },
    constrain(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); },
    millis: () => 1000,
    document: { body: { dataset: {} } },
  });

  for (const file of ['vehicle.js', 'steeringBehaviors.js', 'evolution.js', 'paperArt.js', 'worldBackdrop.js', 'propArt.js', 'creatureArt.js', 'obstacle.js', 'environmentElement.js', 'environment.js', 'spiritEscape.js', 'fleeTarget.js', 'seekVehicle.js', 'mission.js', 'powerUp.js', 'hideSpot.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return { context, ...vm.runInContext('({ Vehicle, SteeringBehaviors, EnvironmentScene, EnvironmentElement, Obstacle, FleeTarget, SeekVehicle, ENVIRONMENT_DEFINITIONS })', context) };
}

test('fuite de Reynolds : direction opposée, force bornée, cible intacte, nulle sur la menace', () => {
  const { Vehicle, SteeringBehaviors } = makeScene();
  const target = new Vector(0, 0);
  const vehicle = new Vehicle(10, 0);
  vehicle.maxSpeed = 4;
  vehicle.maxForce = 0.2;
  const force = SteeringBehaviors.flee(vehicle, target);
  assert.ok(force.x > 0);
  assert.ok(force.mag() <= vehicle.maxForce + 1e-12);
  assert.deepEqual([target.x, target.y], [0, 0]);
  const onThreat = SteeringBehaviors.flee(vehicle, vehicle.pos);
  assert.deepEqual([onThreat.x, onThreat.y], [0, 0]);

  // Le flee() du vehicle.js du cours vaut −seek() : il s'annule quand l'agent fonce
  // déjà vers la menace à pleine vitesse ; la fuite de Reynolds, elle, le fait demi-tour.
  vehicle.vel.set(-4, 0);
  assert.equal(vehicle.flee(target).mag(), 0);
  assert.ok(SteeringBehaviors.flee(vehicle, target).x > 0);
});

test('freinage : vitesse désirée nulle, force opposée à la vitesse et bornée', () => {
  const { Vehicle, SteeringBehaviors } = makeScene();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxForce = 0.2;
  vehicle.vel.set(3, 4);
  const brake = SteeringBehaviors.brake(vehicle);
  assert.ok(Math.abs(brake.mag() - 0.2) < 1e-12);
  assert.ok(brake.x < 0 && brake.y < 0);
  vehicle.vel.set(0.05, 0);
  assert.deepEqual([SteeringBehaviors.brake(vehicle).x, SteeringBehaviors.brake(vehicle).y], [-0.05, -0]);
  const before = vehicle.vel.copy();
  SteeringBehaviors.brake(vehicle);
  assert.deepEqual([vehicle.vel.x, vehicle.vel.y], [before.x, before.y], 'la vitesse n’est pas modifiée directement');
});

test('arrive ralentit près du but et pursuit anticipe une cible mobile', () => {
  const { Vehicle, SteeringBehaviors } = makeScene();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 4;
  vehicle.maxForce = 10;
  const far = SteeringBehaviors.arrive(vehicle, new Vector(100, 0), 100);
  const near = SteeringBehaviors.arrive(vehicle, new Vector(10, 0), 100);
  assert.ok(near.mag() < far.mag());

  const target = new Vehicle(40, 0);
  target.vel.set(0, 2);
  const pursuit = SteeringBehaviors.pursue(vehicle, target);
  assert.ok(pursuit.y > 0, 'la poursuite doit viser devant la cible qui monte');
});

test('evade, séparation, cohésion, alignement et combinaison restent bornés', () => {
  const { Vehicle, SteeringBehaviors } = makeScene();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 4;
  vehicle.maxForce = 0.25;
  const threat = new Vehicle(40, 0);
  threat.vel.set(0, 2);
  const neighbors = [new Vehicle(12, 0), new Vehicle(0, 18)];
  neighbors[0].vel.set(0, 2);
  neighbors[1].vel.set(0, 2);

  assert.ok(SteeringBehaviors.evade(vehicle, threat).x < 0);
  assert.ok(SteeringBehaviors.separate(vehicle, neighbors).x < 0);
  assert.ok(SteeringBehaviors.cohesion(vehicle, neighbors).x > 0);
  assert.ok(SteeringBehaviors.align(vehicle, neighbors).y > 0);
  const combined = SteeringBehaviors.combine(vehicle, [
    { force: new Vector(10, 0), weight: 3 },
    { force: new Vector(0, 10), weight: 3 },
  ]);
  assert.ok(combined.mag() <= vehicle.maxForce + 1e-12);
});

test('évitement par projection et suivi de route produisent des forces utiles', () => {
  const { Vehicle, SteeringBehaviors } = makeScene();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 3;
  vehicle.maxForce = 0.2;
  vehicle.vel.set(2, 0);
  const obstacle = new Vehicle(20, 3);
  obstacle.r = 5;
  const avoidance = SteeringBehaviors.avoidObstacle(vehicle, new Vector(100, 0), [obstacle]);
  assert.ok(avoidance);
  assert.ok(avoidance.y < 0, 'l’agent doit contourner par le côté dégagé');
  assert.ok(avoidance.mag() <= vehicle.maxForce + 1e-12);

  const stationary = new Vehicle(0, 0);
  stationary.maxSpeed = 3;
  stationary.maxForce = 0.2;
  const stationaryAvoidance = SteeringBehaviors.avoidObstacle(stationary, new Vector(100, 0), [obstacle]);
  assert.ok(stationaryAvoidance, 'un agent immobile doit prendre la direction de sa cible pour éviter l’obstacle');
  assert.ok(stationaryAvoidance.mag() <= stationary.maxForce + 1e-12);

  const routeVehicle = new Vehicle(25, 0);
  routeVehicle.vel.set(2, 0);
  routeVehicle.maxForce = 0.2;
  const route = [new Vector(0, 40), new Vector(100, 40)];
  const following = SteeringBehaviors.followPath(routeVehicle, route);
  assert.ok(following.y > 0);
  assert.ok(following.mag() <= routeVehicle.maxForce + 1e-12);
});

test('les six environnements du diorama ont leurs propres obstacles, routes et mobiles Vehicle', () => {
  const { Vehicle, EnvironmentScene, ENVIRONMENT_DEFINITIONS } = makeScene();
  const ids = Object.keys(ENVIRONMENT_DEFINITIONS);
  assert.deepEqual(ids, ['emerald', 'ice', 'gold', 'volcano', 'sky', 'ocean']);

  const scene = new EnvironmentScene();
  const signatures = new Set();
  for (const id of ids) {
    scene.setEnvironment(id, 800, 600);
    const obstacles = scene.createObstacles(800, 600);
    const patrol = scene.patrolPath(800, 600);
    assert.ok(obstacles.length >= 4);
    assert.ok(obstacles.every(obstacle => obstacle instanceof Vehicle));
    assert.ok(patrol.length >= 5);
    assert.ok(scene.elements.length > 0);
    assert.ok(scene.elements.every(element => element instanceof Vehicle));
    assert.ok(scene.definition.spirit?.kind, `espèce absente pour ${id}`);
    assert.doesNotThrow(() => scene.drawBackground(800, 600), `fond graphique invalide : ${id}`);
    signatures.add(`${scene.definition.obstacles.map(item => item[3]).join(',')}:${scene.definition.elements.map(item => item.kind).join(',')}`);
  }
  assert.equal(signatures.size, ids.length, 'chaque lieu doit changer ses props et ses créatures');
  assert.equal(new Set(ids.map(id => ENVIRONMENT_DEFINITIONS[id].spirit.kind)).size, ids.length,
    'chaque thème doit donner une apparence propre aux créatures sauvables');
  assert.equal(new Set(ids.map(id => ENVIRONMENT_DEFINITIONS[id].guardian?.kind)).size, ids.length,
    'chaque thème doit avoir une espèce de veilleur différente');
  assert.ok(ids.every(id => ENVIRONMENT_DEFINITIONS[id].guardian?.label && ENVIRONMENT_DEFINITIONS[id].guardian?.speedMultiplier),
    'chaque veilleur doit avoir un nom et un réglage de vitesse');
});

test('les veilleurs changent de silhouette et de vitesse selon le décor', () => {
  const { SeekVehicle, ENVIRONMENT_DEFINITIONS } = makeScene();
  const ids = Object.keys(ENVIRONMENT_DEFINITIONS);
  const guardians = ids.map(id => {
    const vehicle = new SeekVehicle(100, 100, ENVIRONMENT_DEFINITIONS[id].guardian);
    return { kind: vehicle.guardianKind, speed: vehicle.cruiseSpeed, radius: vehicle.r };
  });
  assert.equal(new Set(guardians.map(item => item.kind)).size, ids.length);
  assert.equal(new Set(guardians.map(item => item.speed)).size, ids.length);
  assert.ok(guardians.every(item => item instanceof Object && item.speed > 0));
});

test('les esprits changent de forme avec le thème et conservent cette forme en se dédoublant', () => {
  const { FleeTarget } = makeScene();
  const fish = new FleeTarget(50, 50, 1.4, false);
  fish.setSpiritKind('bee');
  const duplicate = fish.duplicateAt(75, 50);
  assert.equal(fish.spiritKind, 'bee');
  assert.equal(duplicate.spiritKind, 'bee');
  fish.setSpiritKind('unknown');
  assert.equal(fish.spiritKind, 'firefly', 'une espèce inconnue revient au visuel de forêt');
});

test('les esprits utilisent evade en poursuite et gardent les seuils de capture', () => {
  const { Vehicle, FleeTarget } = makeScene();
  const target = new FleeTarget(50, 50, 1.4, false);
  const hunter = new Vehicle(100, 50);
  const captured = target.think([hunter], 500, { neighbors: [target] });
  assert.equal(captured, false, '50 px dépasse le rayon de capture de 44 px');
  assert.equal(target.mode, 'flee');
  assert.equal(target.escapeStartedAt, 500);
  assert.equal(target.maxSpeed, FleeTarget.PURSUIT_SPEED_BONUS + 1.4);
  target.steer({ neighbors: [target] });
  target.update();
  assert.ok(target.vel.mag() > 0);
  assert.ok(target.vel.x < 0, 'evade : à l’opposé du veilleur');

  hunter.pos.set(90, 50);
  assert.equal(target.think([hunter], 600, {}), true, 'seuil de capture inclusif');
  assert.equal(target.mode, 'captured');
});

test('esprit : think ne déplace rien, steer applique une force, update intègre une fois', () => {
  const { Vehicle, FleeTarget } = makeScene();
  const target = new FleeTarget(50, 50, 1.4, false);
  target.vel.set(1, 0);
  const hunter = new Vehicle(150, 50);
  target.think([hunter], 500, {});
  assert.deepEqual([target.pos.x, target.pos.y, target.vel.x, target.vel.y, target.acc.x, target.acc.y], [50, 50, 1, 0, 0, 0]);
  target.steer({});
  assert.ok(target.acc.mag() > 0 && target.acc.mag() <= target.maxForce + 1e-12, 'force combinée bornée à maxForce');
  assert.deepEqual([target.pos.x, target.vel.x], [50, 1], 'steer ne touche ni la position ni la vitesse');
  target.update();
  assert.deepEqual([target.acc.x, target.acc.y], [0, 0], 'accélération remise à zéro par la locomotion');

  // sortie de fuite : limites normales restaurées exactement
  target.think([], 600, {});
  assert.equal(target.mode, 'wander');
  assert.equal(target.maxSpeed, 1.4);
  assert.equal(target.maxForce, target.baseMaxForce);
  assert.equal(target.escapeStartedAt, null);
});

test('duplication : l’esprit freine par steering, sans téléportation, et son double naît à côté', () => {
  const { FleeTarget } = makeScene();
  const target = new FleeTarget(300, 200, 1.4, false);
  target.vel.set(3, 0);
  target.beginDuplicationAnimation(1000);
  assert.deepEqual([target.pos.x, target.pos.y, target.vel.x], [300, 200, 3], 'rien n’est déplacé au départ');
  const speeds = [];
  for (let frame = 0; frame < 40; frame++) {
    assert.equal(target.think([], 1000 + frame * 16, {}), false);
    assert.equal(target.mode, 'duplicating');
    target.steer({});
    assert.ok(target.acc.x <= 0, 'force de freinage opposée à la vitesse');
    target.update();
    speeds.push(target.vel.mag());
  }
  assert.ok(speeds.every((speed, i) => i === 0 || speed <= speeds[i - 1] + 1e-12), 'vitesse décroissante');
  assert.ok(speeds.at(-1) < 1e-9, 'arrêt complet par freinage');
  const before = target.pos.copy();
  const total = FleeTarget.DUPLICATION_FORM_MS + FleeTarget.DUPLICATION_HOLD_MS;
  assert.equal(target.completeDuplicationAnimation(1000 + total - 1), null);
  const birth = target.completeDuplicationAnimation(1000 + total);
  assert.deepEqual([target.pos.x, target.pos.y], [before.x, before.y], 'le parent ne bouge pas');
  assert.ok(Math.abs(birth.x - (before.x + FleeTarget.DUPLICATION_SEPARATION)) < 1e-9);
  assert.equal(target.duplicationStartedAt, undefined);

  // près du bord droit, le double naît à gauche
  const edge = new FleeTarget(790, 200, 1.4, false);
  edge.beginDuplicationAnimation(0);
  assert.ok(edge.completeDuplicationAnimation(total).x < 790);
});

test('vitesse nulle réglée par le curseur : la locomotion l’impose, sans écriture directe', () => {
  const { FleeTarget } = makeScene();
  const target = new FleeTarget(50, 50, 1.4, false);
  target.vel.set(1, 1);
  target.setSpeed(0);
  assert.deepEqual([target.vel.x, target.vel.y], [1, 1], 'setSpeed ne modifie pas la vitesse');
  target.think([], 0, {});
  target.steer({});
  target.update();
  assert.equal(target.vel.mag(), 0);
});

test('les commandes HTML chargent les modules et exposent mission, tutoriel et environnements', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sketch = gameSource();
  for (const script of ['steeringBehaviors.js', 'evolution.js', 'environment.js', 'sceneParticle.js', 'sceneLabel.js', 'sceneRing.js', 'mission.js']) {
    assert.ok(html.includes(`<script src="${script}"></script>`), `script absent : ${script}`);
  }
  for (const id of ['emerald', 'ice', 'gold', 'volcano', 'sky', 'ocean']) assert.ok(html.includes(`value="${id}"`));
  for (const id of ['mission-panel', 'mission-fill', 'level-number', 'level-up-card', 'tutorial-card', 'tutorial-help', 'end-card', 'evolution-enabled', 'steering-debug-enabled']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(!html.includes('lab-panel') && !html.includes('title-lab'), 'le laboratoire séparé est retiré : ses notions sont dans le jeu');
  assert.match(readFileSync(new URL('../evolution.js', import.meta.url), 'utf8'), /class NeuralNetwork/);
  assert.match(sketch, /MissionProgress\.recordRescue\(missionProgress\)/);
  assert.match(sketch, /function replayGame\(\)[\s\S]*?MissionProgress\.restartLevel\(missionProgress, gameState === 'won'\)/);
  assert.match(sketch, /game-replay'\)\.addEventListener\('click', replayGame\)/);
  assert.match(sketch, /end-replay'\)\.addEventListener\('click', replayGame\)/);
  assert.match(sketch, /missionProgress = MissionProgress\.create\(startingLevel\)/);
  assert.match(sketch, /if \(transition\.completed\) advanceMissionLevel\(transition, now\)/);
  assert.match(sketch, /gameElapsedMs = 0;\s*gameStartedAt = now/);
  assert.match(sketch, /MISSION_DURATION_MS\s*=\s*180000/);
});

test('un veilleur patrouille, poursuit une cible visible puis enquête sur sa dernière position', () => {
  const { SeekVehicle } = makeScene();
  const guardian = new SeekVehicle(0, 0, { kind: 'moth', speedMultiplier: 1 });
  const player = { pos: new Vector(90, 0), playerControlled: true, isHidden: false, vel: new Vector(0, 0) };

  assert.equal(guardian.chooseBehaviorTarget([], 1000, 1), null);
  assert.equal(guardian.aiState, 'patrol');
  assert.equal(guardian.chooseBehaviorTarget([player], 1100, 1), player);
  assert.equal(guardian.aiState, 'chase');
  player.isHidden = true;
  const memoryTarget = guardian.chooseBehaviorTarget([player], 1200, 1);
  assert.equal(guardian.aiState, 'investigate');
  assert.equal(memoryTarget.memoryTarget, true);
  assert.equal(memoryTarget.pos.x, 90);
  assert.equal(guardian.chooseBehaviorTarget([player], 5000, 1), null);
  assert.equal(guardian.aiState, 'patrol');
});
