import test from 'node:test';
import { gameSource, GAME_MODULES } from './gameSource.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSpirits, runArena, Vector } from './spiritHarness.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// les tableaux créés dans le contexte vm n'ont pas le même prototype : on compare leur JSON
const plain = x => JSON.parse(JSON.stringify(x));
const same = (a, b, message) => assert.deepEqual(plain(a), plain(b), message);

// Cerveau contrôlé : couche cachée nulle, donc sortie i = tanh(biais i) ; ±10 donne ≈ ±1.
function fixedBrain(g, biases = {}) {
  const [inputs, hidden] = g.NeuralSteeringDNA.sizes();
  const first = Array.from({ length: hidden }, () => new Array(inputs + 1).fill(0));
  const second = g.SPIRIT_BRAIN.outputs.map(name => [biases[name] ?? -10, ...new Array(hidden).fill(0)]);
  return new g.NeuralNetwork([first, second]);
}

const GENES = { fearWeight: 1.5, separationWeight: 1, cohesionWeight: 0.2, perceptionRadius: 200, escapeSpeed: 3 };

function spiritWith(g, biases, x = 500, y = 350) {
  return new g.NeuralSpirit(x, y, 1.4, false, new g.NeuralSteeringDNA(GENES, fixedBrain(g, biases)));
}

function watcherAt(g, x, y) {
  const watcher = new g.SeekVehicle(x, y, { kind: 'moth', speedMultiplier: 1 });
  return watcher;
}

function playerAt(g, x, y) {
  return new g.FleeTarget(x, y, 1.4, true);
}

// ---------- réseau ----------

test('réseau : tailles par défaut inchangées (voitures) et tailles libres (esprits)', () => {
  const { g } = loadSpirits();
  const car = new g.NeuralNetwork();
  same(car.sizes(), [4, 6, 2]);
  assert.equal(car.forward([0.2, 0.7, 0.4, -0.1]).length, 2);
  const spirit = new g.NeuralNetwork(null, [9, 8, 4]);
  same(spirit.sizes(), [9, 8, 4]);
  const outputs = spirit.forward(new Array(9).fill(1));
  assert.ok(outputs.length === 4 && outputs.every(v => v >= -1 && v <= 1));
  assert.throws(() => spirit.forward([1, 2]), /attend 9 entrées/);
  assert.throws(() => spirit.crossover(car), /tailles différentes/);
});

test('réseau : propagation exacte, copie indépendante, aller-retour JSON', () => {
  const { g } = loadSpirits();
  const net = new g.NeuralNetwork([[[0.5, 1, -1]], [[0, 2]]]);
  same(net.sizes(), [2, 1, 1]);
  assert.ok(near(net.forward([1, 0.5])[0], Math.tanh(2 * Math.tanh(1))));
  const copy = net.copy();
  copy.weights[0][0][0] = 9;
  assert.equal(net.weights[0][0][0], 0.5);
  same(g.NeuralNetwork.fromJSON(plain(net)).weights, net.weights);
});

// ---------- ADN neuronal ----------

test('ADN neuronal : hérite de SteeringDNA, copie profonde, croisement et mutation', () => {
  const { g } = loadSpirits({ seed: 2 });
  const a = new g.NeuralSteeringDNA(GENES);
  assert.ok(a instanceof g.SteeringDNA);
  same(a.brain.sizes(), g.NeuralSteeringDNA.sizes());
  const copy = a.copy();
  assert.notEqual(copy.brain, a.brain);
  same(copy.brain.weights, a.brain.weights);

  const child = a.crossover(new g.NeuralSteeringDNA(GENES));
  assert.ok(child instanceof g.NeuralSteeringDNA);
  const before = plain(child.brain.weights);
  assert.equal(child.mutate(1), child, 'mutation en place, comme SteeringDNA');
  assert.notDeepEqual(plain(child.brain.weights), before);
  assert.ok(child.genes.fearWeight >= 0 && child.genes.fearWeight <= 3.5);

  // partenaire classique : le cerveau est recopié
  const mixed = a.crossover(new g.SteeringDNA(GENES));
  same(mixed.brain.weights, a.brain.weights);
  // ADN classique converti, cerveau aléatoire
  const wrapped = g.NeuralSteeringDNA.from(new g.SteeringDNA(GENES));
  assert.ok(wrapped instanceof g.NeuralSteeringDNA);
  assert.equal(wrapped.genes.perceptionRadius, 200);
  assert.equal(g.NeuralSteeringDNA.from(a), a);
  assert.ok(g.NeuralSteeringDNA.isCompatible(plain(a)));
  assert.ok(!g.NeuralSteeringDNA.isCompatible({ brain: { weights: new g.NeuralNetwork().weights } }));
});

// ---------- réservoir ----------

test('réservoir : fitness, esprits classiques ignorés, taille bornée et oubli progressif', () => {
  const { g } = loadSpirits({ seed: 3 });
  const pool = new g.SpiritBrainPool(3, 0.1, 0.5);
  const spirit = spiritWith(g, {});
  spirit.threatenedMs = 4000;
  assert.equal(g.SpiritBrainPool.fitness(spirit, true), 4 + g.SpiritBrainPool.RESCUE_BONUS);
  assert.equal(g.SpiritBrainPool.fitness(spirit, false), 4);

  pool.record(new g.FleeTarget(0, 0), true);
  assert.equal(pool.entries.length, 0, 'un esprit classique ne dépose pas de cerveau');
  assert.equal(pool.rescued, 0);

  pool.record(spirit, true);
  assert.equal(pool.entries[0].fitness, 14);
  assert.notEqual(pool.entries[0].dna, spirit.dna, 'ADN copié');
  pool.record(spirit, false);
  assert.equal(pool.entries[0].fitness, 7, 'ancien score divisé par deux (decay 0.5)');
  assert.equal(pool.entries[1].fitness, 4);
  for (let i = 0; i < 5; i++) pool.record(spirit, false);
  assert.equal(pool.entries.length, 3);
  assert.equal(pool.rescued, 1);
  assert.equal(pool.caught, 6);
  assert.ok(near(pool.rescueRate(), 1 / 7));
});

test('réservoir : naissance aléatoire puis descendants neuronaux, amorçage compatible', () => {
  const { g } = loadSpirits({ seed: 4 });
  const pool = new g.SpiritBrainPool(4);
  assert.ok(pool.breed() instanceof g.NeuralSteeringDNA, 'réservoir vide');
  const good = { fitness: 12, dna: plain(new g.NeuralSteeringDNA(GENES)) };
  const outdated = { fitness: 50, dna: { genes: GENES, brain: { weights: new g.NeuralNetwork().weights } } };
  assert.equal(pool.seed({ entries: [good, outdated, {}] }), 1);
  assert.equal(pool.seed(null), 0);
  pool.add(new g.NeuralSteeringDNA(GENES), 5);
  const child = pool.breed();
  assert.ok(child instanceof g.NeuralSteeringDNA);
  assert.equal(pool.births, 2);
});

// ---------- esprit neuronal ----------

test('esprit neuronal : hérite de FleeTarget et de Vehicle, ADN toujours neuronal', () => {
  const { g } = loadSpirits();
  const spirit = new g.NeuralSpirit(10, 10);
  assert.ok(spirit instanceof g.FleeTarget && spirit instanceof g.Vehicle);
  assert.ok(spirit.dna instanceof g.NeuralSteeringDNA);
  assert.ok(new g.NeuralSpirit(0, 0, 1.4, false, new g.SteeringDNA(GENES)).dna instanceof g.NeuralSteeringDNA);
  spirit.dna = new g.SteeringDNA(GENES);
  spirit.applyDNA();
  assert.ok(spirit.dna instanceof g.NeuralSteeringDNA, 'évolution mixte : cerveau recréé');
});

test('esprit neuronal : la duplication donne un esprit neuronal au cerveau muté', () => {
  const { g } = loadSpirits({ seed: 5 });
  const parent = spiritWith(g, { evade: 10 });
  const child = parent.duplicateAt(540, 350);
  assert.ok(child instanceof g.NeuralSpirit);
  assert.ok(child.dna instanceof g.NeuralSteeringDNA);
  assert.notEqual(child.dna.brain, parent.dna.brain);
  assert.ok(new g.FleeTarget(0, 0).duplicateAt(10, 0).constructor === g.FleeTarget, 'classe classique conservée');
});

test('esprit neuronal : entrées bornées dans [−1, 1] et position relative de la luciole', () => {
  const { g, rng } = loadSpirits({ seed: 6 });
  for (let n = 0; n < 40; n++) {
    const spirit = spiritWith(g, {}, 200 + rng() * 600, 150 + rng() * 400);
    spirit.vel.set(rng() * 6 - 3, rng() * 6 - 3);
    const watcher = watcherAt(g, spirit.pos.x + rng() * 300 - 150, spirit.pos.y + rng() * 300 - 150);
    watcher.vel.set(rng() * 8 - 4, rng() * 8 - 4);
    spirit.nearest = spirit.findNearestShip([watcher]);
    const inputs = spirit.senses({
      neighbors: [spiritWith(g, {}, spirit.pos.x + 10, spirit.pos.y)],
      obstacles: [new g.Obstacle(rng() * 1000, rng() * 700, 30)],
      player: playerAt(g, rng() * 1000, rng() * 700),
      sanctuaries: [new g.Sanctuary(rng() * 1000, rng() * 700, 0)],
    });
    assert.equal(inputs.length, g.SPIRIT_BRAIN.inputs.length);
    for (const x of inputs) assert.ok(Number.isFinite(x) && x >= -1 && x <= 1, `entrée hors bornes : ${x}`);
  }
  const spirit = spiritWith(g, {});
  spirit.nearest = spirit.findNearestShip([watcherAt(g, 600, 350)]);
  const opposite = spirit.senses({ player: playerAt(g, 400, 350) });
  assert.ok(near(opposite[3], -1), 'luciole à l\'opposé du veilleur');
  assert.ok(near(opposite[2], 1 - 100 / g.NeuralSpirit.PLAYER_RANGE));
  const behind = spirit.senses({ player: playerAt(g, 700, 350) });
  assert.ok(near(behind[3], 1), 'luciole derrière le veilleur');
  const far = spirit.senses({ player: playerAt(g, 500, 350 + g.NeuralSpirit.PLAYER_RANGE + 1) });
  assert.equal(far[2], 0, 'hors de portée');
  assert.equal(far[3], 0);
});

test('esprit neuronal : le réseau choisit entre fuir tout droit et rejoindre la luciole', () => {
  const { g, clock } = loadSpirits({ seed: 7 });
  const run = biases => {
    const spirit = spiritWith(g, biases);
    const watcher = watcherAt(g, 600, 350);
    const player = playerAt(g, 500, 200);
    const context = { player, sanctuaries: [] };
    assert.equal(spirit.think([watcher], clock.now, context), false);
    assert.equal(spirit.mode, 'flee');
    spirit.steer(context);
    spirit.update();
    return spirit;
  };
  const toPlayer = run({ toPlayer: 10 });
  assert.ok(near(toPlayer.brainWeights.toPlayer, g.SPIRIT_BRAIN.scale.toPlayer, 1e-6));
  assert.ok(toPlayer.vel.y < 0 && Math.abs(toPlayer.vel.y) > Math.abs(toPlayer.vel.x), 'monte vers la luciole');
  const evader = run({ evade: 10 });
  assert.ok(evader.vel.x < 0 && Math.abs(evader.vel.x) > Math.abs(evader.vel.y), 'fuit à l\'opposé du veilleur');
  for (const spirit of [toPlayer, evader]) {
    assert.ok(spirit.vel.mag() <= spirit.maxForce + 1e-9, 'combine limite la force à maxForce');
    assert.equal(spirit.maxForce, spirit.baseMaxForce * g.FleeTarget.ESCAPE_FORCE_MULTIPLIER);
  }
});

test('esprit neuronal : forces de fuite selon les repères perçus', () => {
  const { g } = loadSpirits({ seed: 8 });
  const spirit = spiritWith(g, { toRefuge: 10 });
  const watcher = watcherAt(g, 600, 350);
  spirit.think([watcher], 1000, {});
  assert.equal(spirit.fleeForces({}).length, 3, 'evade, séparation, évitement seulement');
  const refuge = new g.Sanctuary(500, 450, 0);
  const context = { player: playerAt(g, 300, 350), sanctuaries: [refuge] };
  spirit.think([watcher], 1016, context);
  const forces = spirit.fleeForces(context);
  assert.equal(forces.length, 5);
  assert.ok(near(forces[4].weight, g.SPIRIT_BRAIN.scale.toRefuge, 1e-6));
  assert.ok(forces[4].force.y > 0, 'arrive vers le refuge');
  assert.ok(forces[0].force.x < 0, 'evade opposé au veilleur');
  assert.ok(forces.every(({ force }) => !force || force.mag() <= spirit.maxForce + 1e-9));
  // la luciole du joueur seule compte (pas un esprit sauvage)
  spirit.think([watcher], 1032, { player: new g.FleeTarget(450, 350, 1.4, false) });
  assert.equal(spirit.perceived.player, null);
});

test('esprit neuronal : temps de fuite mesuré avec le temps écoulé, borné après une pause', () => {
  const { g } = loadSpirits({ seed: 9 });
  const spirit = spiritWith(g, { evade: 10 });
  const watcher = watcherAt(g, 600, 350);
  spirit.think([watcher], 1000, {});
  assert.equal(spirit.threatenedMs, 0, 'première image : pas de durée');
  spirit.think([watcher], 1016, {});
  spirit.think([watcher], 1032, {});
  assert.equal(spirit.threatenedMs, 32);
  spirit.think([watcher], 6032, {});
  assert.equal(spirit.threatenedMs, 132, 'saut d\'horloge borné à 100 ms');
  // plus de menace : errance classique, poids remis à zéro, chronomètre figé
  spirit.think([], 6048, {});
  assert.equal(spirit.threatenedMs, 132);
  assert.ok(Object.values(spirit.brainWeights).every(w => w === 0));
  assert.equal(spirit.escapeStartedAt, null);
  // capture : seuil de détection inclusif
  const caught = spiritWith(g, {});
  assert.equal(caught.think([watcherAt(g, 500 + g.FleeTarget.DETECTION_RADIUS, 350)], 7000, {}), true);
  assert.ok(Object.values(caught.brainWeights).every(w => w === 0), 'capturé : pas de décision');
});

// ---------- arène et cerveaux pré-entraînés ----------

test('arène : une minute de jeu avec esprits neuronaux, sans NaN, réservoir alimenté', () => {
  const env = loadSpirits({ seed: 21 });
  const result = runArena(env, { minutes: 1 });
  assert.ok(result.rescued + result.caught > 0);
  assert.equal(result.pool.rescued + result.pool.caught, result.rescued + result.caught);
  assert.ok(result.pool.entries.length > 0);
  for (const spirit of result.wild) {
    assert.ok(spirit instanceof env.g.NeuralSpirit);
    assert.ok(Number.isFinite(spirit.pos.x) && Number.isFinite(spirit.vel.y));
  }
});

test('cerveaux pré-entraînés : compatibles et meilleurs que les esprits classiques sur une carte inédite', () => {
  const classicEnv = loadSpirits({ seed: 1001 });
  const classic = runArena(classicEnv, { minutes: 5, neural: false, learn: false });
  const trainedEnv = loadSpirits({ seed: 1001, pretrained: true });
  const data = trainedEnv.g.PRETRAINED_SPIRIT_BRAINS;
  assert.ok(data && data.entries.length > 0, 'spiritBrainPretrained.js présent');
  same(data.inputs, trainedEnv.g.SPIRIT_BRAIN.inputs);
  same(data.outputs, trainedEnv.g.SPIRIT_BRAIN.outputs);
  const pool = new trainedEnv.g.SpiritBrainPool(16, 0.1);
  assert.equal(pool.seed(data), data.entries.length);
  const trained = runArena(trainedEnv, { minutes: 5, pool, learn: false });
  assert.ok(trained.rescueRate > classic.rescueRate,
    `taux de sauvetage entraîné ${trained.rescueRate.toFixed(3)} ≤ classique ${classic.rescueRate.toFixed(3)}`);
});

test('jeu : scripts chargés, case à cocher et bilans de sauvetage et de capture', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sketch = gameSource();
  const order = ['evolution.js', 'neuralSteeringDNA.js', 'spiritBrainPool.js', 'spiritBrainPretrained.js', 'fleeTarget.js', 'neuralSpirit.js', ...GAME_MODULES];
  const positions = order.map(file => html.indexOf(`<script src="${file}"></script>`));
  assert.ok(positions.every(p => p >= 0), 'script absent');
  assert.ok(positions.every((p, i) => i === 0 || p > positions[i - 1]), 'ordre de chargement');
  assert.ok(html.includes('id="neural-spirits-enabled"') && html.includes('id="neural-spirits-status"'));
  assert.match(sketch, /spiritBrainPool\.record\(target, true\)/);
  assert.match(sketch, /spiritBrainPool\.record\(target, false\)/);
  assert.match(sketch, /new NeuralSpirit\(position\.x, position\.y, targetSpeed, false, spiritBrainPool\.breed\(\)\)/);
  assert.match(sketch, /spiritBrainPool\.seed\(PRETRAINED_SPIRIT_BRAINS\)/);
  assert.match(sketch, /const context = \{ pointerGoal: [^\n]*neighbors, obstacles, player, sanctuaries, call: currentCall\(now\) \}/);
  assert.match(sketch, /target\.think\(hunters, now, context\)/);
  assert.match(sketch, /target\.steer\(context\)/);
  // une seule intégration par image et par cible, après le steering de toutes les cibles
  assert.match(sketch, /for \(const target of targets\) \{\s*target\.update\(\);\s*target\.edges\(\);/);
  assert.ok(!/updateAgainst/.test(sketch), 'ancienne méthode tout-en-un retirée');
});

test('debug : une couleur pour chaque sortie du réseau (sinon fill(undefined) bloque le dessin)', () => {
  const { g } = loadSpirits();
  const debug = readFileSync(new URL('../debugView.js', import.meta.url), 'utf8');
  const colors = debug.match(/BRAIN_DEBUG_COLORS = \{([^}]*)\}/)[1];
  for (const output of g.SPIRIT_BRAIN.outputs) assert.ok(new RegExp(`\\b${output}:`).test(colors), `couleur manquante : ${output}`);
});
