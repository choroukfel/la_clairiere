import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSpirits, Vector } from './spiritHarness.mjs';

const { g } = loadSpirits({ seed: 3 });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const GENES = { fearWeight: 1.5, separationWeight: 1, cohesionWeight: 0.2, perceptionRadius: 150, escapeSpeed: 3 };
const spirit = (x, y) => new g.FleeTarget(x, y, 1.4, false, new g.SteeringDNA(GENES));
const watcher = (x, y, kind = 'moth') => new g.SeekVehicle(x, y, { kind, speedMultiplier: 1 });
const types = events => JSON.parse(JSON.stringify(events.map(e => e.type)));

// ---------- micro : clap, double clap, cri ----------

test('micro : un pic bref est un clap, deux claps rapprochés un double clap', () => {
  const d = new g.ClapDetector();
  const feed = levels => levels.map(([level, t]) => d.update(level, t)).filter(Boolean);
  const events = feed([[0.01, 0], [0.6, 16], [0.7, 32], [0.01, 48], [0.01, 200], [0.5, 332], [0.01, 348]]);
  assert.deepEqual(types(events), ['clap', 'double-clap']);
  assert.ok(near(events[0].loudness, 0.7));
  const d2 = new g.ClapDetector();
  const spaced = [[0.6, 0], [0.01, 16], [0.6, 1000], [0.01, 1016]].map(([l, t]) => d2.update(l, t)).filter(Boolean);
  assert.deepEqual(types(spaced), ['clap', 'clap'], 'claps trop espacés : deux claps simples');
});

test('micro : un son fort maintenu est un cri, signalé une seule fois', () => {
  const d = new g.ClapDetector();
  const events = [];
  for (let t = 0; t <= 1000; t += 20) { const e = d.update(0.5, t); if (e) events.push(e); }
  const end = d.update(0.01, 1020);
  if (end) events.push(end);
  assert.deepEqual(types(events), ['shout'], 'pas de clap à la fin d’un cri');
});

test('micro : le seuil s’adapte au bruit ambiant', () => {
  const d = new g.ClapDetector({ threshold: 0.18, floorRatio: 3 });
  for (let t = 0; t < 4000; t += 16) d.update(0.1, t);
  assert.ok(d.currentThreshold() > 0.25);
  assert.equal(d.update(0.22, 4100), null, 'un son à peine plus fort que le bruit n’est pas un clap');
});

// ---------- appel : perception auditive ----------

test('appel : rayon d’audition selon le volume, seuil inclusif, durée limitée', () => {
  const quiet = new g.SoundCall(0, 0, 0, 1000);
  const loud = new g.SoundCall(0, 0, 1, 1000);
  assert.equal(quiet.radius, g.SoundCall.BASE_RADIUS);
  assert.equal(loud.radius, g.SoundCall.MAX_RADIUS, 'plafonné');
  assert.ok(quiet.hears({ pos: new Vector(g.SoundCall.BASE_RADIUS, 0) }), 'seuil inclusif');
  assert.ok(!quiet.hears({ pos: new Vector(g.SoundCall.BASE_RADIUS + 0.01, 0) }));
  assert.ok(quiet.isActive(1000 + g.SoundCall.DURATION_MS - 1));
  assert.ok(!quiet.isActive(1000 + g.SoundCall.DURATION_MS));
});

test('appel : un esprit qui l’entend rejoint la luciole ; la fuite reste prioritaire', () => {
  const call = new g.SoundCall(400, 350, 0.4, 1000);
  const s = spirit(600, 350);
  s.think([], 1000, { call });
  assert.equal(s.mode, 'called');
  s.steer({ call });
  assert.ok(s.acc.x < 0, 'force vers la luciole');
  const deaf = spirit(400 + call.radius + 50, 350);
  deaf.think([], 1000, { call });
  assert.equal(deaf.mode, 'wander', 'hors de portée');
  const scared = spirit(600, 350);
  scared.think([watcher(700, 350)], 1000, { call });
  assert.equal(scared.mode, 'flee', 'la fuite passe avant l’appel');
  const player = new g.FleeTarget(450, 350, 1.4, true);
  player.think([], 1000, { call, pointerGoal: null });
  assert.notEqual(player.mode, 'called');
});

test('appel : un veilleur sans cible vient enquêter à l’endroit du bruit, pas un veilleur en chasse', () => {
  const call = new g.SoundCall(300, 300, 0.5, 1000);
  const w = watcher(500, 300);
  assert.equal(w.hear(call, 1000), true);
  assert.equal(w.aiState, 'investigate');
  const memory = w.chooseBehaviorTarget([], 1100, 1, []);
  assert.ok(memory.memoryTarget);
  assert.deepEqual([memory.pos.x, memory.pos.y], [300, 300]);
  const hunter = watcher(500, 300);
  hunter.aiState = 'chase';
  assert.equal(hunter.hear(call, 1000), false);
  assert.equal(watcher(500 + call.radius + 300, 300).hear(call, 1000), false, 'trop loin');
});

// ---------- ligne de vue et cachette ----------

test('perception : un obstacle entre le veilleur et l’esprit le cache ; sinon il le poursuit', () => {
  const rock = new g.Obstacle(150, 0, 30);
  assert.equal(g.SteeringBehaviors.lineOfSight(new Vector(0, 0), new Vector(300, 0), [rock]), false);
  assert.equal(g.SteeringBehaviors.lineOfSight(new Vector(0, 0), new Vector(300, 100), [rock]), true);
  const w = watcher(0, 0);
  const wall = [new g.Obstacle(100, 0, 30)];
  const hidden = spirit(170, 0);
  const visible = spirit(100, 120);
  assert.equal(w.chooseBehaviorTarget([hidden], 1000, 1, wall), null, 'esprit caché derrière le rocher');
  assert.equal(w.chooseBehaviorTarget([visible], 1000, 1, wall), visible);
});

test('hide : cachette derrière l’obstacle, à l’opposé de la menace ; arrive vers elle', () => {
  const s = spirit(100, 100);
  const threat = watcher(0, 300);
  const rock = new g.Obstacle(200, 300, 30);
  const spot = g.SteeringBehaviors.hidingSpot(s, threat, [rock], 18);
  assert.ok(near(spot.point.x, 200 + 30 + s.r + 18) && near(spot.point.y, 300), 'derrière le rocher, côté opposé');
  assert.equal(spot.obstacle, rock);
  const force = g.SteeringBehaviors.hide(s, threat, [rock]);
  assert.ok(force.x > 0 && force.y > 0, 'vers la cachette');
  assert.equal(g.SteeringBehaviors.hide(s, threat, []), null, 'sans obstacle, pas de cachette');
  assert.equal(g.SteeringBehaviors.lineOfSight(threat.pos, spot.point, [rock]), false, 'invisible depuis la menace');
});

test('esprit neuronal : la cachette et « caché » font partie de ses entrées, « se cacher » de ses sorties', () => {
  assert.ok(g.SPIRIT_BRAIN.inputs.includes('hideSpot') && g.SPIRIT_BRAIN.inputs.includes('hidden'));
  assert.ok(g.SPIRIT_BRAIN.outputs.includes('toHide'));
  const s = new g.NeuralSpirit(260, 300, 1.4, false, new g.NeuralSteeringDNA(GENES));
  const w = watcher(0, 300);
  const rock = new g.Obstacle(200, 300, 30);
  s.think([w], 1000, { obstacles: [rock] });
  const inputs = s.senses({ obstacles: [rock] });
  assert.equal(inputs.length, g.SPIRIT_BRAIN.inputs.length);
  const input = name => inputs[g.SPIRIT_BRAIN.inputs.indexOf(name)];
  assert.equal(input('hidden'), 1, 'caché derrière le rocher');
  assert.ok(input('hideSpot') > 0, 'cachette proche');
  assert.ok(s.fleeForces({ obstacles: [rock] }).length >= 4, 'force « se cacher » ajoutée');
});

// ---------- poursuite parfaite ----------

test('poursuite parfaite : point d’interception exact, repli prédictif si impossible', () => {
  const pursuer = watcher(0, 0, 'frost-lynx');
  pursuer.maxSpeed = 2;
  const target = spirit(100, 0);
  target.vel.set(0, 1);
  const point = g.SteeringBehaviors.interceptPoint(pursuer, target);
  const t = 100 / Math.sqrt(3); // |(100, t)| = 2t
  assert.ok(near(point.x, 100, 1e-6) && near(point.y, t, 1e-6));
  const force = g.SteeringBehaviors.pursuePerfect(pursuer, target);
  assert.ok(force.y > 0 && force.x > 0);
  const fast = spirit(100, 0);
  fast.vel.set(5, 0);
  assert.equal(g.SteeringBehaviors.interceptPoint(pursuer, fast), null, 'cible plus rapide qui s’éloigne');
  assert.ok(g.SteeringBehaviors.pursuePerfect(pursuer, fast).x > 0, 'repli : poursuite prédictive');
});

test('poursuite parfaite : le chat et le requin visent le point d’interception, la mite non', () => {
  const prey = spirit(200, 0);
  prey.vel.set(0, 2);
  const cat = watcher(0, 0, 'frost-lynx');
  cat.applyBehaviors(prey, [], [], []);
  assert.ok(cat.interceptTarget && cat.interceptTarget.y > 0);
  const shark = watcher(0, 0, 'lantern-angler');
  shark.applyBehaviors(prey, [], [], []);
  assert.ok(shark.interceptTarget);
  const moth = watcher(0, 0, 'ash-moth');
  moth.applyBehaviors(prey, [], [], []);
  assert.equal(moth.interceptTarget, null);
});

// ---------- cortège ----------

test('cortège : chaque esprit sauvé suit son meneur par derrière, s’écarte de devant lui, puis s’envole', () => {
  const leader = new g.FleeTarget(300, 300, 1.4, true);
  leader.vel.set(2, 0);
  const follower = new g.FollowerSpirit(200, 300, 'bee', leader, 1000);
  assert.ok(follower instanceof g.Vehicle);
  const behind = follower.followPoint();
  const future = 300 + 2 * g.FollowerSpirit.LOOKAHEAD_FRAMES;
  assert.ok(near(behind.x, future - g.FollowerSpirit.SPACING) && near(behind.y, 300), 'point derrière la position future du meneur');
  follower.steer([follower]);
  assert.ok(follower.acc.x > 0, 'rejoint le cortège');
  assert.equal(follower.lastForces.clear, null, 'pas devant le meneur');
  const inFront = new g.FollowerSpirit(340, 300, 'bee', leader, 1000);
  inFront.steer([inFront]);
  assert.ok(inFront.lastForces.clear && inFront.lastForces.clear.mag() > 0, 's’écarte de la route du meneur');
  assert.ok(follower.isAlive(1000 + g.FollowerSpirit.LIFETIME_MS - 1));
  assert.ok(!follower.isAlive(1000 + g.FollowerSpirit.LIFETIME_MS));
  // une file de deux esprits reste ordonnée derrière le meneur
  const a = new g.FollowerSpirit(250, 300, 'bee', leader, 1000);
  const b = new g.FollowerSpirit(220, 300, 'bee', a, 1000);
  for (let i = 0; i < 300; i++) {
    leader.pos.add(leader.vel);
    for (const f of [a, b]) f.steer([a, b]);
    for (const f of [a, b]) f.update();
  }
  assert.ok(a.pos.x < leader.pos.x && b.pos.x < a.pos.x, 'file ordonnée');
  assert.ok(Math.abs(leader.pos.x - a.pos.x - g.FollowerSpirit.SPACING) < 12, 'distance de suivi tenue');
});

// ---------- sons ----------

test('sons : aucun son sans contexte audio (son désactivé), sons connus seulement', () => {
  assert.equal(g.SoundEffects.play('rescue'), false);
  assert.equal(g.SoundEffects.play('inconnu'), false);
  for (const name of ['rescue', 'capture', 'lost', 'duplicate', 'sanctuary', 'powerup', 'level', 'call']) {
    assert.ok(g.SoundEffects.SOUNDS[name].notes.length > 0, name);
  }
});

test('esprit neuronal : trois capteurs à rayons (ex. 9) en entrée du réseau, obstacles et veilleurs', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(g.SPIRIT_BRAIN.inputs.slice(-3))), ['rayFront', 'rayLeft', 'rayRight']);
  const s = new g.NeuralSpirit(300, 300, 1.4, false, new g.NeuralSteeringDNA(GENES));
  assert.equal(s.sensors.length, 3);
  assert.ok(s.sensors.every(sensor => !(sensor instanceof g.Vehicle)), 'perceptions, pas des entités');
  const w = watcher(220, 300); // veilleur derrière (à gauche)
  const rock = new g.Obstacle(380, 300, 30); // rocher droit devant
  s.vel.set(2, 0);
  s.think([w], 1000, { obstacles: [rock] });
  assert.equal(s.mode, 'flee');
  const [front, left, right] = s.rayReadings;
  assert.ok(front > 0, 'le rocher devant est détecté');
  assert.equal(left, 0);
  assert.equal(right, 0);
  const inputs = s.senses({ obstacles: [rock] });
  assert.equal(inputs.length, g.SPIRIT_BRAIN.inputs.length);
  assert.equal(inputs[g.SPIRIT_BRAIN.inputs.indexOf('rayFront')], front);
  // un veilleur dans l'axe gauche est aussi un danger
  const s2 = new g.NeuralSpirit(300, 300, 1.4, false, new g.NeuralSteeringDNA(GENES));
  s2.vel.set(2, 0);
  const flank = watcher(300 + 60, 300 - 60);
  s2.think([flank], 1000, {});
  assert.ok(s2.rayReadings[1] > 0, 'veilleur détecté à 45° à gauche');
  assert.deepEqual([s2.pos.x, s2.pos.y], [300, 300], 'mesurer ne déplace pas l’esprit');
});

// ---------- téléphone : pilotage au doigt et interface compacte ----------

test('téléphone : un toucher place le but, le glissement ne fait pas défiler la page, bouton Appel', async () => {
  const { readFileSync } = await import('node:fs');
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const sketch = read('sketch.js');
  assert.match(sketch, /addEventListener\('pointerdown', updatePointerGoal\)/);
  assert.match(sketch, /touchAction = 'none'/);
  assert.match(read('index.html'), /id="call-trigger"/);
  assert.match(sketch, /'call-trigger'\)\.addEventListener\('click'[^\n]*emitCall\(/);
  const css = read('style.css');
  assert.match(css, /@media \(pointer: coarse\)\s*\{\s*#game-hint \{ display: none; \}/, 'aide clavier masquée au doigt');
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*#mission-panel \{ top: auto; bottom: 8px/, 'mission en bas sur téléphone');
  assert.match(css, /@media \(max-height: 500px\)[\s\S]*\.game-brand \{ display: none; \}[\s\S]*#mission-panel \{ top: auto; bottom: 8px/, 'téléphone à l’horizontale');
});
