import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSpirits, Vector } from './spiritHarness.mjs';
import { gameSource } from './gameSource.mjs';

const plain = x => JSON.parse(JSON.stringify(x));

test('feu follet : un missile génétique (ex. 10) du jeu, donc un Vehicle ; ADN = une force bornée par image', () => {
  const { g } = loadSpirits({ seed: 1 });
  const wisp = new g.MigratingWisp(50, 50);
  assert.ok(wisp instanceof g.GeneticRocket && wisp instanceof g.Vehicle);
  assert.equal(wisp.dna.genes.length, g.MigratingWisp.GENES);
  assert.ok(wisp.dna.genes.every(gene => gene.mag() <= g.MigratingWisp.MAX_FORCE + 1e-12));
  const nest = new g.WispNest(900, 50);
  assert.ok(nest instanceof g.Vehicle);
  const before = wisp.dna.genes[0].copy();
  wisp.step(nest, [], 600);
  assert.ok(Math.abs(wisp.vel.x - before.x) < 1e-12 && Math.abs(wisp.vel.y - before.y) < 1e-12, 'premier gène appliqué par applyForce puis update');
  assert.equal(wisp.geneIndex, 1);
});

test('feu follet : un veilleur touché termine le vol (capturé) ; le nid atteint aussi (réussi)', () => {
  const { g } = loadSpirits({ seed: 2 });
  const nest = new g.WispNest(500, 300);
  const caught = new g.MigratingWisp(200, 300);
  caught.step(nest, [], 600, [{ pos: new Vector(200, 300), r: 13 }]);
  assert.ok(caught.caught && caught.finished && !caught.hitTarget);
  const home = new g.MigratingWisp(500, 300);
  home.step(nest, [], 600, [{ pos: new Vector(500, 300), r: 13 }]);
  assert.ok(home.hitTarget && !home.caught, 'arrivé au nid : pas de capture');
  const rock = new g.MigratingWisp(100, 100);
  rock.step(nest, [{ pos: new Vector(100, 100), r: 30 }], 600);
  assert.ok(rock.hitObstacle && rock.finished);
});

test('population génétique générique : point de départ et type d’individu en paramètres, élitisme', () => {
  const { g } = loadSpirits({ seed: 3 });
  const population = new g.GeneticPopulation({
    size: 6, lifetime: 5, spawn: () => ({ x: 42, y: 24 }), create: (x, y, dna) => new g.MigratingWisp(x, y, dna),
  });
  assert.equal(population.rockets.length, 6);
  assert.ok(population.rockets.every(w => w instanceof g.MigratingWisp && w.pos.x === 42 && w.pos.y === 24));
  const nest = new g.WispNest(700, 300); // loin : personne n'arrive, la génération dure 5 images
  for (let i = 0; i < 5; i++) population.step(nest, []);
  assert.equal(population.generation, 2);
  const ranked = population.rockets;
  assert.equal(ranked.length, 6);
  assert.ok(ranked.every(w => w.geneIndex === 0 && w.pos.x === 42), 'nouvelle génération au départ');
  // par défaut, toujours des missiles génétiques classiques
  const rockets = new g.GeneticPopulation({ size: 3, lifetime: 2 });
  assert.ok(rockets.rockets.every(r => r.constructor === g.GeneticRocket));
});

test('migration : une récompense par arrivée, historique par génération, changement de décor sans perte d’ADN', () => {
  const { g } = loadSpirits({ seed: 4, width: 1400, height: 900 });
  const m = g.WispMigration;
  m.reset(1400, 900);
  assert.equal(m.population.rockets.length, m.SIZE);
  assert.ok(m.start.x < 200 && m.nest.pos.x > 1200, 'départ à gauche, nid à droite');
  // un feu follet placé dans le nid : une seule récompense
  const wisp = m.population.rockets[0];
  wisp.pos.set(m.nest.pos.x, m.nest.pos.y);
  wisp.vel.set(0, 0);
  wisp.dna.genes[0].set(0, 0);
  let rewards = 0;
  m.update([], [], () => rewards++);
  m.update([], [], () => rewards++);
  assert.equal(rewards, 1);
  assert.equal(m.totalArrivals, 1);
  while (m.population.generation === 1) m.update([], []);
  assert.equal(m.history.length, 1);
  assert.equal(m.history[0].arrived, 1);
  assert.equal(m.arrivedThisFlight, 0);
  // changement de décor : mêmes ADN, positions de départ recalculées
  const genes = plain(m.population.rockets.map(w => w.dna.genes[5]));
  m.relocate(1000, 700);
  assert.deepEqual(plain(m.population.rockets.map(w => w.dna.genes[5])), genes);
  assert.ok(Math.abs(m.nest.pos.x - Math.max(1000 - 80, 900)) < 1e-9);
  assert.ok(m.population.rockets.every(w => w.geneIndex === 0 && Math.abs(w.pos.x - m.start.x) < 1e-9));
  // désactivée : rien ne bouge
  m.enabled = false;
  const frame = m.population.frame;
  m.update([], []);
  assert.equal(m.population.frame, frame);
  m.enabled = true;
  assert.match(m.status(), /Feux follets · génération 2/);
});

test('migration : les feux follets apprennent à contourner un mur de rochers', () => {
  const { g } = loadSpirits({ seed: 5, width: 1400, height: 900 });
  const m = g.WispMigration;
  m.reset(1400, 900);
  // mur de rochers au milieu, sur la ligne droite départ → nid : il faut le contourner
  const rocks = [330, 450, 570].map(y => new g.Obstacle(700, y, 55));
  while (m.population.generation <= 45) m.update(rocks, []);
  const first = m.history.find(entry => entry.arrived > 0);
  assert.ok(first && first.generation <= 30, `première arrivée en moins de 30 générations (${first?.generation})`);
  const late = m.history.slice(-5).reduce((sum, entry) => sum + entry.arrived, 0) / 5;
  const early = m.history.slice(0, 5).reduce((sum, entry) => sum + entry.arrived, 0) / 5;
  assert.ok(late > early, `plus d’arrivées à la fin (${late}) qu’au début (${early})`);
  assert.ok(late >= 3, `au moins 3 feux follets sur 18 au nid en fin d’entraînement (${late})`);
});

test('jeu : migration branchée (mise à jour, récompense, affichage, réglage)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const game = gameSource();
  for (const script of ['geneticRocket.js', 'migratingWisp.js', 'wispNest.js', 'wispMigration.js']) {
    assert.ok(html.includes(`<script src="${script}"></script>`), script);
  }
  assert.ok(html.includes('id="migration-enabled"') && html.includes('id="migration-status"'));
  assert.match(game, /WispMigration\.update\(obstacles, vehicles,/);
  assert.match(game, /rewardPoints \+= 1;/);
  assert.match(game, /WispMigration\.show\(now\)/);
  assert.match(game, /WispMigration\.relocate\(width, height\)/);
  assert.match(game, /updateMigration\(\)/);
});
