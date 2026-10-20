import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { Vector, seededRng } from './spiritHarness.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

function scene() {
  const rng = seededRng(3);
  const clock = { now: 1000 };
  const context = vm.createContext({
    createVector: (x = 0, y = 0) => new Vector(x, y),
    p5: { Vector: Object.assign(Vector, { random2D: () => Vector.fromAngle(rng() * Math.PI * 2) }) },
    width: 800, height: 600, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, PI: Math.PI,
    random(a, b) {
      if (Array.isArray(a)) return a[0];
      if (a === undefined) return rng();
      if (b === undefined) return rng() * a;
      return a + rng() * (b - a);
    },
    constrain: (v, min, max) => Math.max(min, Math.min(max, v)),
    color: (...values) => values,
    millis: () => clock.now,
  });
  for (const file of ['vehicle.js', 'steeringBehaviors.js', 'evolution.js', 'geneticRocket.js', 'sceneParticle.js', 'sceneLabel.js',
    'environmentElement.js', 'environment.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  return { clock, ...vm.runInContext(`({ Vehicle, SceneParticle, SceneLabel, EnvironmentElement, EnvironmentScene,
    ENVIRONMENT_DEFINITIONS, GeneticRocket })`, context) };
}

test('confettis : traînée de Reynolds (désirée = vitesse × frottement) au lieu de vel.mult', () => {
  const { SceneParticle } = scene();
  const particle = new SceneParticle(100, 100, { vx: 3, vy: -2, radius: 2, rgb: [1, 2, 3], duration: 500, gravity: 0.015, friction: 0.97 });
  particle.steer();
  assert.deepEqual([particle.vel.x, particle.vel.y], [3, -2], 'steer ne touche pas la vitesse');
  assert.ok(near(particle.acc.x, 3 * -0.03) && near(particle.acc.y, 0.015 - 2 * -0.03), 'gravité + traînée');
  particle.update();
  assert.ok(near(particle.vel.x, 3 * 0.97) && near(particle.vel.y, -2 * 0.97 + 0.015), 'même effet que l’ancien frottement');
  assert.ok(particle.maxForce >= particle.maxSpeed * 0.03, 'la traînée à pleine vitesse reste dans maxForce');
  let previous = Infinity;
  for (let i = 0; i < 30; i++) {
    particle.steer();
    particle.update();
    assert.ok(Math.abs(particle.vel.x) < previous);
    previous = Math.abs(particle.vel.x);
  }
});

test('message flottant : une force vers le haut, locomotion héritée', () => {
  const { SceneLabel } = scene();
  const label = new SceneLabel(50, 50, '+1', [255, 255, 255]);
  label.steer();
  assert.deepEqual([label.acc.x, label.acc.y], [0, -0.012]);
  const y = label.pos.y;
  label.update();
  assert.ok(label.pos.y < y);
  assert.deepEqual([label.acc.x, label.acc.y], [0, 0]);
});

test('décor : steer borné, une intégration par image, bouclage explicite aux bords', () => {
  const { EnvironmentElement, EnvironmentScene, ENVIRONMENT_DEFINITIONS } = scene();
  const snow = new EnvironmentElement(100, 100, { kind: 'snowflake', speed: 0.4 });
  const before = snow.pos.copy();
  snow.steer();
  assert.deepEqual([snow.pos.x, snow.pos.y], [before.x, before.y], 'steer ne déplace rien');
  assert.ok(snow.acc.mag() <= snow.maxForce + 1e-12);

  const sceneManager = new EnvironmentScene('ice');
  const elements = [snow, new EnvironmentElement(300, 300, { kind: 'glow-mote', speed: 0.22 })];
  sceneManager.elements = elements;
  const expected = elements.map(element => element.pos.copy());
  sceneManager.updateElements(800, 600);
  elements.forEach((element, i) => assert.ok(element.pos.x !== expected[i].x || element.pos.y !== expected[i].y));
  assert.ok(elements.every(element => element.acc.mag() === 0), 'locomotion héritée : accélération remise à zéro');

  // règle de scène : la neige sortie par le bas revient en haut
  snow.pos.set(200, 600 + 9);
  snow.wrapInScene(800, 600);
  assert.equal(snow.pos.y, -8);
  assert.ok(ENVIRONMENT_DEFINITIONS.ice);
});

test('missile génétique : le bord termine le vol sans recadrer la position', () => {
  const { GeneticRocket } = scene();
  const rocket = new GeneticRocket(2, 300);
  rocket.edgesLab();
  assert.equal(rocket.finished, true);
  assert.equal(rocket.hitObstacle, true);
  assert.equal(rocket.pos.x, 2, 'position conservée');
});

// ---------- conformité aux consignes du cours ----------

const SOURCES = readdirSync(new URL('..', import.meta.url)).filter(file => file.endsWith('.js'));
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('conformité : vehicle.js est exactement celui de 1-Seek (code fourni, non modifié)', () => {
  const hash = createHash('md5').update(readFileSync(new URL('../vehicle.js', import.meta.url))).digest('hex');
  assert.equal(hash, 'd9f50eda0e1787ca42a73c1aadbedfbf');
});

test('conformité : une seule entité (sous-classe de Vehicle) par fichier', () => {
  for (const file of SOURCES) {
    const entities = read(file).match(/^class \w+ extends (Vehicle|FleeTarget|SeekVehicle|Obstacle)\b/gm) ?? [];
    assert.ok(entities.length <= 1, `${file} : ${entities.join(', ')}`);
  }
});

test('conformité : aucune entité ne modifie sa vitesse par vel.mult / vel.limit ni ne garde de timer permanent', () => {
  for (const file of SOURCES.filter(f => f !== 'vehicle.js' && f !== 'sketch.js')) {
    const source = read(file);
    assert.ok(!/\.vel\.(mult|limit)\(/.test(source), `${file} modifie directement la vitesse`);
    assert.ok(!/setInterval\(/.test(source), `${file} garde un timer permanent`);
  }
});
