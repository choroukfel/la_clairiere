import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSpirits } from './spiritHarness.mjs';

const { g } = loadSpirits({ seed: 2 });
const GENES = { fearWeight: 1.5, separationWeight: 1, cohesionWeight: 0.2, perceptionRadius: 150, escapeSpeed: 3 };
const spirit = (x = 500, y = 350) => new g.FleeTarget(x, y, 1.4, false, new g.SteeringDNA(GENES));
const watcher = (x, y = 350) => new g.SeekVehicle(x, y, { kind: 'moth', speedMultiplier: 1 });

test('fuite : seuil de déclenchement inclusif, veilleur le plus proche', () => {
  const s = spirit();
  assert.equal(s.detectionRadius, 150);
  assert.equal(s.exitDistance, 150 + g.SpiritEscape.SAFETY_MARGIN);
  s.think([watcher(500 + 151)], 1000, {});
  assert.equal(s.escape.state, 'normal', 'juste hors du rayon : pas de fuite');
  const far = watcher(500 + 400);
  const close = watcher(500 + 150);
  s.think([far, close], 1016, {});
  assert.equal(s.escapeTransition, 'start');
  assert.equal(s.mode, 'flee');
  assert.equal(s.nearest.ship, close);
  assert.equal(s.escape.threatDistance, 150);
});

test('fuite : continue entre déclenchement et sécurité, sortie inclusive à la distance de sécurité', () => {
  const s = spirit();
  const w = watcher(500 + 100);
  s.think([w], 1000, {});
  assert.equal(s.mode, 'flee');
  w.pos.set(500 + 180, 350); // hors du cercle de déclenchement, pas encore en sécurité
  s.think([w], 1016, {});
  assert.equal(s.mode, 'flee', 'sortir du cercle ne suffit pas');
  w.pos.set(500 + s.exitDistance - 0.01, 350);
  s.think([w], 1032, {});
  assert.equal(s.mode, 'flee');
  w.pos.set(500 + s.exitDistance, 350);
  s.think([w], 1048, {});
  assert.equal(s.escapeTransition, 'safe');
  assert.equal(s.mode, 'wander');
});

test('fuite : durée exacte, endurance décroissante, épuisement puis réarmement en sécurité', () => {
  const s = spirit();
  const w = watcher(500 + 100);
  let now = 1000;
  s.think([w], now, {}); // départ de la fuite
  const endurances = [];
  // 3500 ms à pleine endurance : 35 images de 100 ms
  for (let i = 0; i < 34; i++) {
    now += 100;
    s.think([w], now, {});
    assert.equal(s.mode, 'flee');
    endurances.push(s.escape.endurance);
  }
  assert.ok(endurances.every((e, i) => i === 0 || e < endurances[i - 1]), 'endurance décroissante');
  now += 100;
  s.think([w], now, {});
  assert.equal(s.escapeTransition, 'exhausted', 'épuisé à 3500 ms exactement');
  assert.equal(s.escape.endurance, 0);
  assert.equal(s.mode, 'wander');
  // limites normales restaurées exactement à l'épuisement
  assert.equal(s.maxSpeed, 1.4);
  assert.equal(s.maxForce, s.baseMaxForce);
  // pas de réarmement à l'image suivante, même hors du cercle de déclenchement
  w.pos.set(500 + 180, 350);
  now += 100;
  s.think([w], now, {});
  assert.equal(s.escape.state, 'exhausted');
  assert.equal(s.escape.endurance, 0, 'pas de régénération pendant l’épuisement');
  w.pos.set(500 + s.exitDistance, 350);
  now += 100;
  s.think([w], now, {});
  assert.equal(s.escapeTransition, 'rearmed');
  // en état normal, l'endurance se régénère (0,25 par seconde)
  w.pos.set(500 + 1000, 350);
  for (let i = 0; i < 20; i++) { now += 100; s.think([w], now, {}); }
  assert.ok(Math.abs(s.escape.endurance - 0.5) < 1e-9, '20 × 100 ms à 0,25 par seconde');
  // une nouvelle fuite dure endurance × durée maximale
  w.pos.set(500 + 100, 350);
  now += 100; s.think([w], now, {});
  assert.equal(s.escapeTransition, 'start');
  const start = s.escape.startEndurance;
  let frames = 0;
  while (s.escape.state === 'flee') { now += 100; s.think([w], now, {}); frames++; }
  assert.equal(frames, Math.ceil(start * 35 - 1e-9));
});

test('fuite : limites de sprint pendant la fuite, restaurées exactement à la sortie', () => {
  const s = spirit();
  const w = watcher(500 + 120);
  s.think([w], 1000, {});
  assert.equal(s.maxSpeed, 1.4 + Math.max(g.FleeTarget.PURSUIT_SPEED_BONUS, GENES.escapeSpeed));
  assert.equal(s.maxForce, s.baseMaxForce * g.FleeTarget.ESCAPE_FORCE_MULTIPLIER);
  w.pos.set(500 + s.exitDistance + 1, 350);
  s.think([w], 1016, {});
  assert.equal(s.maxSpeed, 1.4);
  assert.equal(s.maxForce, s.baseMaxForce);
});

test('fuite : temps écoulé borné à 100 ms (une pause ne vide pas l’endurance)', () => {
  const s = spirit();
  const w = watcher(500 + 100);
  s.think([w], 1000, {});
  s.think([w], 60000, {});
  assert.equal(s.elapsedMs, 100);
  assert.ok(Math.abs(s.escape.endurance - (1 - 100 / 3500)) < 1e-9);
});

test('fuite : la transition de scénario remet la fuite à zéro sans recréer l’esprit', () => {
  const s = spirit();
  const w = watcher(500 + 100);
  s.think([w], 1000, {});
  for (let t = 1100; t <= 2000; t += 100) s.think([w], t, {});
  assert.equal(s.mode, 'flee');
  s.resetEscape();
  assert.equal(s.escape.state, 'normal');
  assert.equal(s.escape.endurance, 1);
  assert.equal(s.escapeStartedAt, null);
  assert.equal(s.maxSpeed, 1.4);
  assert.equal(s.mode, 'wander');
});

test('fuite : la luciole guidée par le joueur n’utilise pas la fuite', () => {
  const player = new g.FleeTarget(500, 350, 1.4, true);
  player.think([watcher(500 + 100)], 1000, { pointerGoal: new player.pos.constructor(600, 350) });
  assert.equal(player.mode, 'guided');
  assert.equal(player.escape.state, 'normal');
});
