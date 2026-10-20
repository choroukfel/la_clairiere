import test from 'node:test';
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
  static mult(a, n) { return new Vector(a.x * n, a.y * n); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static fromAngle(angle) { return new Vector(Math.cos(angle), Math.sin(angle)); }
}

// Fonctions de dessin globales espionnées : un rendu dirigé vers une cible `g`
// ne doit jamais les appeler (sinon les miniatures du menu seraient fausses).
const GLOBAL_DRAWING = ['fill', 'stroke', 'noFill', 'noStroke', 'strokeWeight', 'circle', 'ellipse', 'rect',
  'line', 'arc', 'triangle', 'quad', 'beginShape', 'vertex', 'endShape', 'push', 'pop', 'translate', 'rotate',
  'scale', 'text', 'textAlign', 'textSize', 'textStyle', 'textFont', 'strokeJoin', 'strokeCap', 'image', 'background'];

function makeContext() {
  const globalCalls = [];
  const spies = Object.fromEntries(GLOBAL_DRAWING.map(name => [name, () => globalCalls.push(name)]));
  const context = vm.createContext({
    ...spies,
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    width: 800,
    height: 600,
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    HALF_PI: Math.PI / 2,
    CLOSE: 'close',
    BOLD: 'bold',
    CENTER: 'center',
    ROUND: 'round',
    random(first, second) {
      if (Array.isArray(first)) return first[0];
      if (second === undefined) return first * 0.5;
      return (first + second) * 0.5;
    },
    constrain(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); },
    millis: () => 1000,
    document: { body: { dataset: {} } },
  });
  const files = ['vehicle.js', 'steeringBehaviors.js', 'evolution.js', 'paperArt.js', 'worldBackdrop.js', 'propArt.js',
    'creatureArt.js', 'obstacle.js', 'sanctuary.js', 'environmentElement.js', 'environment.js', 'sceneParticle.js', 'sceneRing.js', 'sceneLabel.js',
    'spiritEscape.js', 'fleeTarget.js', 'seekVehicle.js', 'powerUp.js', 'hideSpot.js'];
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  const api = vm.runInContext(`({ PaperArt, WorldBackdrop, PropArt, CreatureArt, ENVIRONMENT_DEFINITIONS, SPIRIT_ART,
    Obstacle, Sanctuary, EnvironmentElement, SceneParticle, SceneRing, SceneLabel, FleeTarget, SeekVehicle, PowerUp, HideSpot })`, context);
  return { context, globalCalls, ...api };
}

// Cible de dessin factice : enregistre chaque appel sans rien dessiner.
function recorder() {
  const calls = [];
  return new Proxy({}, {
    get(_, name) {
      if (name === 'calls') return calls;
      if (name === 'drawingContext') return undefined;
      return (...args) => { calls.push({ name, args }); };
    },
  });
}

function assertBalanced(g, label) {
  const pushes = g.calls.filter(call => call.name === 'push').length;
  const pops = g.calls.filter(call => call.name === 'pop').length;
  assert.equal(pushes, pops, `push/pop déséquilibrés : ${label}`);
  assert.ok(g.calls.length > 0, `aucun dessin : ${label}`);
}

const WORLD_IDS = ['emerald', 'ice', 'gold', 'volcano', 'sky', 'ocean'];

test('PaperArt : aléatoire reproductible, couleurs et contours organiques bornés', () => {
  const { PaperArt } = makeContext();
  const a = PaperArt.rng(42);
  const b = PaperArt.rng(42);
  const values = Array.from({ length: 20 }, () => a());
  assert.deepEqual(values, Array.from({ length: 20 }, () => b()));
  assert.ok(values.every(value => value >= 0 && value < 1));
  assert.notEqual(PaperArt.hash('emerald'), PaperArt.hash('ice'));

  assert.equal(PaperArt.mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(PaperArt.shade('#808080', 0.5), '#404040');
  assert.equal(PaperArt.shade('#ffffff', 2), '#ffffff', 'les composantes restent bornées à 255');
  assert.deepEqual(Array.from(PaperArt.rgb('#ff8000')), [255, 128, 0]);

  const blob = PaperArt.blob(PaperArt.rng(7), 10, 0.2, 24);
  assert.equal(blob.length, 24);
  assert.deepEqual(blob, PaperArt.blob(PaperArt.rng(7), 10, 0.2, 24), 'même graine, même contour');
  for (const point of blob) {
    const radius = Math.hypot(point.x, point.y);
    assert.ok(radius >= 4.5 - 1e-9 && radius <= 10 * (1 + 0.2 * 2), `rayon hors bornes : ${radius}`);
  }
});

test('la figurine de papier dessine l’ombre, puis le liseré, puis la couleur', () => {
  const { PaperArt } = makeContext();
  const g = recorder();
  const order = [];
  PaperArt.standee(g, () => order.push('silhouette'), () => order.push('paint'));
  assert.deepEqual(order, ['silhouette', 'silhouette', 'paint']);
  const translate = g.calls.find(call => call.name === 'translate');
  assert.deepEqual(translate.args, [PaperArt.SHADOW_OFFSET.x, PaperArt.SHADOW_OFFSET.y], 'ombre décalée vers le bas-droite');
  assertBalanced(g, 'standee');

  const noShadow = [];
  PaperArt.standee(recorder(), () => noShadow.push('silhouette'), () => noShadow.push('paint'), { shadow: false });
  assert.deepEqual(noShadow, ['silhouette', 'paint']);
});

test('chaque lieu a une figurine pour ses obstacles, son obstacle de niveau et sa cachette', () => {
  const { PropArt, ENVIRONMENT_DEFINITIONS, globalCalls } = makeContext();
  assert.deepEqual(Object.keys(ENVIRONMENT_DEFINITIONS), WORLD_IDS);
  for (const id of WORLD_IDS) {
    const definition = ENVIRONMENT_DEFINITIONS[id];
    const kinds = [...definition.obstacles.map(item => item[3]), definition.extraObstacle, definition.hideSpot];
    for (const kind of kinds) {
      assert.ok(PropArt.has(kind), `figurine absente : ${id}/${kind}`);
      for (const now of [0, 1234, 98765]) {
        const g = recorder();
        PropArt.draw(g, kind, 100, 100, 24, now);
        assertBalanced(g, `${id}/${kind}`);
      }
    }
  }
  assert.equal(PropArt.has('voxel-block'), false);
  const g = recorder();
  assert.doesNotThrow(() => PropArt.draw(g, 'inconnu', 0, 0, 20), 'un type inconnu utilise un rocher de repli');
  assert.deepEqual(globalCalls, []);
});

test('chaque espèce à sauver, chaque veilleur et chaque avatar a son dessin', () => {
  const { CreatureArt, ENVIRONMENT_DEFINITIONS, SPIRIT_ART, globalCalls } = makeContext();
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const avatars = [...html.matchAll(/data-avatar="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(avatars, ['firefly', 'butterfly', 'star', 'moon', 'crystal', 'leaf']);

  for (const kind of Object.keys(SPIRIT_ART)) assert.ok(CreatureArt.hasSpirit(kind), `esprit sans dessin : ${kind}`);
  for (const id of WORLD_IDS) {
    const { spirit, guardian } = ENVIRONMENT_DEFINITIONS[id];
    assert.ok(SPIRIT_ART[spirit.kind], `halo absent pour ${spirit.kind}`);
    assert.ok(CreatureArt.hasGuardian(guardian.kind), `veilleur sans dessin : ${guardian.kind}`);
    for (const now of [0, 777, 54321]) {
      const s = recorder();
      CreatureArt.drawSpirit(s, spirit.kind, 12, { now, phase: 1.3, glow: SPIRIT_ART[spirit.kind].glow });
      assertBalanced(s, `esprit ${spirit.kind}`);
      for (const state of ['patrol', 'chase', 'investigate']) {
        const v = recorder();
        CreatureArt.drawGuardian(v, guardian.kind, 14, { now, phase: 0.4, state });
        assertBalanced(v, `veilleur ${guardian.kind}/${state}`);
      }
    }
  }
  for (const id of avatars) {
    assert.ok(CreatureArt.hasAvatar(id), `avatar sans dessin : ${id}`);
    const g = recorder();
    CreatureArt.drawAvatar(g, id, 12, { now: 500 });
    assertBalanced(g, `avatar ${id}`);
  }
  assert.deepEqual(globalCalls, []);
});

test('l’état du veilleur change la couleur de ses yeux', () => {
  const { CreatureArt } = makeContext();
  const fills = state => {
    const g = recorder();
    CreatureArt.drawGuardian(g, 'bramble', 14, { state });
    return g.calls.filter(call => call.name === 'fill').map(call => call.args[0]);
  };
  assert.ok(fills('chase').includes(CreatureArt.STATE_EYES.chase));
  assert.ok(fills('investigate').includes(CreatureArt.STATE_EYES.investigate));
  assert.ok(fills('patrol').includes(CreatureArt.GUARDIANS.bramble.eye));
  assert.ok(!fills('patrol').includes(CreatureArt.STATE_EYES.chase));
});

test('les nouveaux veilleurs gardent les modes de déplacement et vitesses d’origine', () => {
  const { SeekVehicle, ENVIRONMENT_DEFINITIONS } = makeContext();
  const expected = {
    emerald: ['clockwork', 0.92], ice: ['cat', 1.08], gold: ['mantis', 1.12],
    volcano: ['moth', 1.0], sky: ['moth', 0.96], ocean: ['shark', 0.88],
  };
  for (const id of WORLD_IDS) {
    const guardian = ENVIRONMENT_DEFINITIONS[id].guardian;
    const vehicle = new SeekVehicle(0, 0, guardian);
    assert.equal(vehicle.motionKind, expected[id][0], `mode de déplacement : ${id}`);
    assert.equal(guardian.speedMultiplier, expected[id][1], `multiplicateur : ${id}`);
    assert.equal(vehicle.baseCruiseSpeed, 4 * expected[id][1]);
    assert.equal(vehicle.guardianKind, guardian.kind);
    assert.equal(vehicle.artKind(), guardian.kind);
  }
  const legacy = new SeekVehicle(0, 0, { kind: 'shark', speedMultiplier: 1 });
  assert.equal(legacy.motionKind, 'shark');
  assert.equal(legacy.artKind(), 'lantern-angler', 'un mode seul reçoit un dessin par défaut');
  assert.equal(new SeekVehicle(0, 0, { kind: 'zombie' }).motionKind, 'moth', 'les anciens mobs voxel ne sont plus reconnus');
});

test('le fond est déterministe par lieu et suit la taille de l’écran', () => {
  const { WorldBackdrop, ENVIRONMENT_DEFINITIONS } = makeContext();
  const types = {};
  for (const id of WORLD_IDS) {
    const definition = ENVIRONMENT_DEFINITIONS[id];
    const layout = WorldBackdrop.layout(id, definition);
    assert.equal(WorldBackdrop.layout(id, definition), layout, 'mise en page mise en cache');
    assert.equal(layout.hills.length, WorldBackdrop.HILL_COUNT);
    assert.ok(layout.hills.every(hill => hill.x >= 0 && hill.x <= 1 && hill.y >= 0 && hill.y <= 1));
    types[id] = layout.feature.type;

    const small = WorldBackdrop.geometry(id, definition, 800, 600);
    const large = WorldBackdrop.geometry(id, definition, 1600, 1200);
    assert.equal(WorldBackdrop.geometry(id, definition, 800, 600), small);
    assert.equal(large.unit, small.unit * 2);
    if (small.path) {
      small.path.points.forEach((point, index) => {
        assert.ok(Math.abs(large.path.points[index].x - point.x * 2) < 1e-9);
        assert.ok(Math.abs(large.path.points[index].y - point.y * 2) < 1e-9);
      });
    }
  }
  assert.deepEqual(types, { emerald: 'river', ice: 'lake', gold: 'lake', volcano: 'lava-river', sky: 'wind', ocean: 'sand-channel' });
  const hillsX = WORLD_IDS.map(id => WorldBackdrop.layout(id, ENVIRONMENT_DEFINITIONS[id]).hills[0].x);
  assert.equal(new Set(hillsX).size, WORLD_IDS.length, 'chaque lieu a son propre relief');
});

test('pointAlong parcourt le chemin et reste borné', () => {
  const { WorldBackdrop } = makeContext();
  const path = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    lengths: [0, 10, 20],
    total: 20,
  };
  const start = WorldBackdrop.pointAlong(path, 0);
  const middle = WorldBackdrop.pointAlong(path, 0.25);
  const corner = WorldBackdrop.pointAlong(path, 0.75);
  const end = WorldBackdrop.pointAlong(path, 1.5);
  assert.deepEqual([start.x, start.y], [0, 0]);
  assert.deepEqual([middle.x, middle.y], [5, 0]);
  assert.equal(middle.angle, 0);
  assert.deepEqual([corner.x, corner.y], [10, 5]);
  assert.ok(Math.abs(corner.angle - Math.PI / 2) < 1e-9);
  assert.deepEqual([end.x, end.y], [10, 10], 'au-delà de 1, le point reste au bout du chemin');
});

test('le fond se peint dans sa cible : sol du lieu d’abord, rien sur le canvas global', () => {
  const { WorldBackdrop, ENVIRONMENT_DEFINITIONS, globalCalls } = makeContext();
  for (const id of WORLD_IDS) {
    const definition = ENVIRONMENT_DEFINITIONS[id];
    const g = recorder();
    WorldBackdrop.paint(g, id, definition, 640, 400);
    const firstFill = g.calls.find(call => call.name === 'fill');
    assert.equal(firstFill.args[0], definition.palette.ground, `sol : ${id}`);
    const firstRect = g.calls.find(call => call.name === 'rect');
    assert.deepEqual(firstRect.args, [0, 0, 640, 400]);
    assertBalanced(g, `fond ${id}`);
    for (const now of [0, 4321, 99999]) {
      const motion = recorder();
      WorldBackdrop.drawAnimated(motion, id, definition, 640, 400, now);
      assertBalanced(motion, `animation ${id}`);
    }
  }
  assert.deepEqual(globalCalls, []);
});

test('drawCached peint le tampon une seule fois par taille et se rabat sans createGraphics', () => {
  const { context, WorldBackdrop, ENVIRONMENT_DEFINITIONS } = makeContext();
  const definition = ENVIRONMENT_DEFINITIONS.emerald;
  assert.equal(WorldBackdrop.drawCached('emerald', definition, 800, 600), false, 'sans tampon : décor de secours');

  const buffers = [];
  const drawn = [];
  context.createGraphics = (w, h) => {
    const buffer = recorder();
    buffers.push({ w, h, buffer, removed: false });
    const entry = buffers[buffers.length - 1];
    return new Proxy(buffer, { get: (target, name) => name === 'remove' ? () => { entry.removed = true; } : target[name] });
  };
  context.image = (buffer, x, y, w, h) => drawn.push([x, y, w, h]);

  assert.equal(WorldBackdrop.drawCached('emerald', definition, 800, 600), true);
  assert.equal(WorldBackdrop.drawCached('emerald', definition, 800, 600), true);
  assert.equal(buffers.length, 1, 'même lieu, même taille : aucun repeint');
  assert.deepEqual(drawn, [[0, 0, 800, 600], [0, 0, 800, 600]]);

  WorldBackdrop.drawCached('ice', ENVIRONMENT_DEFINITIONS.ice, 800, 600);
  assert.equal(buffers.length, 2, 'changer de lieu repeint le fond');
  assert.equal(buffers[0].removed, true, 'l’ancien tampon est libéré');
  WorldBackdrop.drawCached('ice', ENVIRONMENT_DEFINITIONS.ice, 1024, 768);
  assert.equal(buffers.length, 3, 'redimensionner repeint le fond');
  assert.deepEqual([buffers[2].w, buffers[2].h], [1024, 768]);
});

test('toutes les entités visibles se dessinent dans leur cible avec un état graphique équilibré', () => {
  const ctx = makeContext();
  const { Obstacle, Sanctuary, EnvironmentElement, SceneParticle, SceneRing, SceneLabel, FleeTarget, SeekVehicle, PowerUp, HideSpot, ENVIRONMENT_DEFINITIONS, globalCalls } = ctx;
  const draw = (label, render) => {
    const g = recorder();
    render(g);
    assertBalanced(g, label);
  };

  draw('obstacle', g => new Obstacle(100, 100, 24, 'round-tree').show(1000, g));
  for (const type of PowerUp.TYPES) draw(`bonus ${type}`, g => new PowerUp(50, 50, type, 0).show(1000, g));
  for (const id of WORLD_IDS) draw(`cachette ${id}`, g => new HideSpot(80, 80, ENVIRONMENT_DEFINITIONS[id].hideSpot).show(1000, g));
  for (const age of [0, 300, 4000, 7900]) draw(`refuge ${age}`, g => new Sanctuary(200, 200, 1000).show(1000 + age, g));
  for (const id of WORLD_IDS) {
    const group = ENVIRONMENT_DEFINITIONS[id].elements[0];
    draw(`ambiance ${group.kind}`, g => new EnvironmentElement(10, 10, group).show(1000, g));
  }
  draw('confetti', g => new SceneParticle(5, 5, { vx: 1, vy: 0, radius: 2, rgb: [255, 0, 0], duration: 500 }).show(1200, g));
  draw('anneau', g => new SceneRing(5, 5, [255, 255, 255]).show(1200, g));
  draw('message', g => new SceneLabel(5, 5, '+1', [255, 255, 255]).show(1200, g));

  const player = new FleeTarget(300, 300, 1.4, true);
  player.playerIcon = 'moon';
  player.vel.set(-2, 1);
  draw('joueur', g => player.show(1000, g));
  const spirit = new FleeTarget(300, 300, 1.4, false);
  spirit.setSpiritKind('ember');
  spirit.threatLevel = 0.6;
  draw('esprit menacé', g => spirit.show(1000, g));
  spirit.beginDuplicationAnimation(1000);
  draw('esprit en duplication', g => spirit.show(1500, g));

  for (const state of ['patrol', 'chase', 'investigate']) {
    const guardian = new SeekVehicle(400, 300, ENVIRONMENT_DEFINITIONS.ocean.guardian);
    guardian.aiState = state;
    guardian.vel.set(-1, 0);
    draw(`veilleur ${state}`, g => guardian.show(1000, g));
  }
  assert.deepEqual(globalCalls, [], 'aucun rendu ne doit dessiner hors de sa cible');
});

test('les décors statiques sont peints une fois en sprite, les décors animés restent en direct', () => {
  const { context, PropArt, ENVIRONMENT_DEFINITIONS } = makeContext();
  const created = [];
  context.createGraphics = (w, h) => {
    const buffer = recorder();
    created.push({ w, h, buffer });
    return buffer;
  };
  const screen = recorder();
  PropArt.draw(screen, 'round-tree', 100, 100, 24, 0);
  PropArt.draw(screen, 'round-tree', 300, 200, 24, 500);
  assert.equal(created.length, 1, 'même type, même rayon : un seul sprite');
  assert.ok(created[0].buffer.calls.length > 10, 'le sprite contient la figurine peinte');
  assert.equal(screen.calls.filter(call => call.name === 'image').length, 2);

  PropArt.draw(screen, 'round-tree', 0, 0, 30, 0);
  assert.equal(created.length, 2, 'un autre rayon crée un autre sprite');

  const before = created.length;
  const live = recorder();
  PropArt.draw(live, 'kelp', 0, 0, 24, 0);
  assert.equal(created.length, before, 'le varech ondule : pas de sprite');
  assert.equal(live.calls.filter(call => call.name === 'image').length, 0);

  const flag = recorder();
  PropArt.draw(flag, 'tent', 0, 0, 24, 1000);
  assert.ok(flag.calls.some(call => call.name === 'image'), 'la tente utilise son sprite');
  assert.ok(flag.calls.filter(call => call.name === 'triangle').length >= 1, 'le drapeau reste animé par-dessus');
  assertBalanced(flag, 'tente');

  PropArt.clearSprites();
  assert.deepEqual(Object.keys(PropArt.sprites), []);
  for (const id of WORLD_IDS) for (const [, , radius, kind] of ENVIRONMENT_DEFINITIONS[id].obstacles) PropArt.draw(recorder(), kind, 0, 0, radius, 0);
  assert.ok(Object.keys(PropArt.sprites).length <= PropArt.MAX_SPRITES);
});

test('les créatures sont animées image par image depuis des sprites mis en cache', () => {
  const { context, CreatureArt } = makeContext();
  const spec = { cycle: 0.01 };
  const period = Math.PI * 2 / spec.cycle;
  assert.equal(CreatureArt.frameIndex(spec, 0, 0), 0);
  assert.equal(CreatureArt.frameIndex(spec, period * 0.5, 0), CreatureArt.FRAMES / 2);
  assert.equal(CreatureArt.frameIndex(spec, period * 0.999, 0), CreatureArt.FRAMES - 1);
  assert.equal(CreatureArt.frameIndex(spec, period * 3.25, 0), CreatureArt.FRAMES / 4, 'le cycle se répète');
  assert.equal(CreatureArt.frameIndex(spec, 0, -Math.PI / 2), CreatureArt.FRAMES * 3 / 4, 'phase négative ramenée dans le cycle');
  assert.equal(CreatureArt.frameIndex({}, 12345, 2), 0, 'sans cycle : une seule pose');

  const created = [];
  context.createGraphics = (w, h) => { const buffer = recorder(); created.push({ w, h, buffer }); return buffer; };
  const screen = recorder();
  CreatureArt.drawSpirit(screen, 'bee', 12, { now: 0 });
  CreatureArt.drawSpirit(screen, 'bee', 12, { now: 1 });
  assert.equal(created.length, 1, 'même pose : sprite réutilisé');
  CreatureArt.drawSpirit(screen, 'bee', 12, { now: Math.PI / 0.03 });
  assert.equal(created.length, 2, 'autre pose : nouveau sprite');
  assert.ok(created[0].buffer.calls.length > 10, 'la pose est peinte dans le sprite');
  assert.ok(screen.calls.some(call => call.name === 'circle'), 'le halo reste dessiné en direct');

  CreatureArt.drawGuardian(screen, 'bramble', 14, { state: 'patrol' });
  CreatureArt.drawGuardian(screen, 'bramble', 14, { state: 'chase' });
  assert.equal(created.length, 4, 'les yeux d’état utilisent des sprites distincts');
  assert.equal(screen.calls.filter(call => call.name === 'image').length, 5);
  CreatureArt.clearSprites();
  assert.deepEqual(Object.keys(CreatureArt.sprites), []);
});
