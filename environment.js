// Mondes du diorama de papier : chaque lieu définit sa palette, son relief de fond,
// ses obstacles, sa cachette, son espèce à sauver, son veilleur et sa route de patrouille.
// Le fond est peint une fois dans un tampon par WorldBackdrop (worldBackdrop.js).
const ENVIRONMENT_DEFINITIONS = {
  emerald: {
    label: "Forêt de l'Émeraude",
    guardian: { kind: 'bramble', label: 'Rôdeur des ronces', speedMultiplier: 0.92, color: '#3b2d4a' },
    spirit: { kind: 'bee', singular: 'abeille', plural: 'abeilles', rescued: 'sauvée', tutorialTarget: 'Une abeille lumineuse' },
    palette: {
      ground: '#24452f', hills: ['#2c5338', '#356243', '#40714d', '#4d8259'],
      feature: { bank: '#5b7d4a', water: '#2f7686', light: '#7cc6c9' },
      detail: ['#6aa564', '#e9d36c'], accent: '#f4d35e', ink: '#132219', vignette: [8, 20, 12],
    },
    backdrop: { feature: 'river', details: 'meadow' },
    patrol: [[0.16, 0.27], [0.47, 0.19], [0.82, 0.28], [0.85, 0.68], [0.53, 0.82], [0.17, 0.68]],
    obstacles: [
      [0.27, 0.36, 26, 'round-tree'], [0.52, 0.68, 28, 'mossy-rock'],
      [0.76, 0.33, 27, 'round-tree'], [0.82, 0.76, 22, 'stump'],
      [0.39, 0.5, 18, 'mushroom'], [0.64, 0.84, 19, 'round-tree'],
    ],
    extraObstacle: 'mossy-rock',
    hideSpot: 'fern-bush',
    elements: [{ kind: 'glow-mote', count: 26, speed: 0.22 }],
  },
  ice: {
    label: 'Montagne de Glace',
    guardian: { kind: 'frost-lynx', label: 'Lynx de givre', speedMultiplier: 1.08, color: '#5d6f8f' },
    spirit: { kind: 'fox', singular: 'renard', plural: 'renards', rescued: 'sauvé', tutorialTarget: 'Un renard polaire' },
    palette: {
      ground: '#9fb8d3', hills: ['#b1c8df', '#c3d6e9', '#d6e4f1', '#eaf1f8'],
      feature: { bank: '#e9f2fa', water: '#7fb0d6', light: '#d3ecff' },
      detail: ['#ffffff', '#6f8fb5'], accent: '#7fd1ff', ink: '#1f2f48', vignette: [30, 48, 80],
    },
    backdrop: { feature: 'lake', details: 'snowfield', frozen: true },
    patrol: [[0.13, 0.22], [0.55, 0.17], [0.86, 0.37], [0.74, 0.78], [0.39, 0.83], [0.15, 0.59]],
    obstacles: [
      [0.21, 0.32, 27, 'snow-pine'], [0.48, 0.68, 30, 'snow-rock'],
      [0.73, 0.3, 28, 'snow-pine'], [0.83, 0.73, 22, 'ice-crystal'],
      [0.34, 0.42, 18, 'snow-rock'], [0.61, 0.82, 19, 'snow-pine'],
    ],
    extraObstacle: 'ice-crystal',
    hideSpot: 'igloo',
    elements: [{ kind: 'snowflake', count: 30, speed: 0.36 }],
  },
  gold: {
    label: "Désert d'Or",
    guardian: { kind: 'dune-scorpion', label: 'Scorpion des dunes', speedMultiplier: 1.12, color: '#6b3a26' },
    spirit: { kind: 'rabbit', singular: 'lapin', plural: 'lapins', rescued: 'sauvé', tutorialTarget: 'Un lapin des sables' },
    palette: {
      ground: '#c98c4b', hills: ['#d39a57', '#dda866', '#e7b979', '#f0cb90'],
      feature: { bank: '#7aa556', water: '#2f9aa0', light: '#9fe0dc' },
      detail: ['#a8692f', '#f6dca8'], accent: '#ff7b54', ink: '#41230f', vignette: [70, 30, 10],
    },
    backdrop: { feature: 'lake', details: 'dunes' },
    patrol: [[0.12, 0.65], [0.32, 0.45], [0.62, 0.5], [0.88, 0.68], [0.66, 0.84], [0.27, 0.82]],
    obstacles: [
      [0.2, 0.67, 26, 'cactus'], [0.42, 0.76, 28, 'mesa-rock'],
      [0.68, 0.63, 28, 'urn'], [0.84, 0.79, 22, 'cactus'],
      [0.54, 0.34, 20, 'cactus'], [0.32, 0.57, 18, 'mesa-rock'],
    ],
    extraObstacle: 'mesa-rock',
    hideSpot: 'tent',
    elements: [{ kind: 'sand-grain', count: 22, speed: 0.5 }],
  },
  volcano: {
    label: 'Île Volcanique',
    guardian: { kind: 'ash-moth', label: 'Phalène de cendre', speedMultiplier: 1.0, color: '#3a3036' },
    spirit: { kind: 'ember', singular: 'braise', plural: 'braises', rescued: 'sauvée', tutorialTarget: 'Une braise vivante' },
    palette: {
      ground: '#231519', hills: ['#2e1b20', '#3a2228', '#472a30', '#55333a'],
      feature: { bank: '#120a0c', water: '#ff5a1f', light: '#ffc15e' },
      detail: ['#ff7a2f', '#5a4246'], accent: '#ff8a3d', ink: '#0f0809', vignette: [10, 2, 4],
    },
    backdrop: { feature: 'lava-river', details: 'ash' },
    patrol: [[0.12, 0.28], [0.43, 0.24], [0.83, 0.3], [0.81, 0.73], [0.45, 0.8], [0.17, 0.7]],
    obstacles: [
      [0.2, 0.39, 28, 'basalt'], [0.52, 0.7, 26, 'lava-vent'],
      [0.78, 0.4, 30, 'basalt'], [0.82, 0.78, 22, 'dead-tree'],
      [0.39, 0.52, 19, 'dead-tree'], [0.64, 0.28, 17, 'lava-vent'],
    ],
    extraObstacle: 'basalt',
    hideSpot: 'cave',
    elements: [{ kind: 'ember-spark', count: 24, speed: 0.4 }],
  },
  sky: {
    label: 'Cité des Nuages',
    guardian: { kind: 'storm-ray', label: "Raie d'orage", speedMultiplier: 0.96, color: '#2f3a78' },
    spirit: { kind: 'bird', singular: 'oiseau', plural: 'oiseaux', rescued: 'sauvé', tutorialTarget: 'Un oiseau des nuages' },
    palette: {
      ground: '#7f9fdc', hills: ['#9cb6e8', '#b6caf0', '#d0def7', '#ecf2fd'],
      feature: { bank: '#ffffff', water: '#c9d8fb', light: '#ffffff' },
      detail: ['#ffffff', '#ffd98a'], accent: '#ffd166', ink: '#26336a', vignette: [30, 40, 100],
    },
    backdrop: { feature: 'wind', details: 'clouds' },
    patrol: [[0.14, 0.29], [0.49, 0.22], [0.82, 0.33], [0.8, 0.72], [0.48, 0.82], [0.18, 0.7]],
    obstacles: [
      [0.23, 0.63, 30, 'cloud-bank'], [0.54, 0.43, 26, 'sky-tower'],
      [0.78, 0.68, 28, 'cloud-bank'], [0.78, 0.32, 22, 'floating-rock'],
      [0.39, 0.76, 19, 'floating-rock'], [0.61, 0.59, 18, 'sky-tower'],
    ],
    extraObstacle: 'cloud-bank',
    hideSpot: 'cloud-nest',
    elements: [{ kind: 'cloud-wisp', count: 9, speed: 0.22 }],
  },
  ocean: {
    label: 'Océan Profond',
    guardian: { kind: 'lantern-angler', label: 'Baudroie-lanterne', speedMultiplier: 0.88, color: '#1b2238' },
    spirit: { kind: 'fish', singular: 'poisson', plural: 'poissons', rescued: 'sauvé', tutorialTarget: 'Un poisson lumineux' },
    palette: {
      ground: '#0d3550', hills: ['#12405f', '#174c6e', '#1d5a7e', '#24698e'],
      feature: { bank: '#2b7b8f', water: '#c9b98a', light: '#efe2b4' },
      detail: ['#3fb39a', '#f0a6c0'], accent: '#5ef2d6', ink: '#051826', vignette: [2, 10, 22],
    },
    backdrop: { feature: 'sand-channel', details: 'seabed' },
    patrol: [[0.12, 0.36], [0.4, 0.2], [0.77, 0.24], [0.87, 0.59], [0.61, 0.82], [0.2, 0.72]],
    obstacles: [
      [0.24, 0.36, 26, 'coral'], [0.5, 0.6, 28, 'clam-rock'],
      [0.74, 0.3, 24, 'kelp'], [0.82, 0.74, 24, 'coral'],
      [0.35, 0.74, 20, 'kelp'], [0.6, 0.82, 18, 'clam-rock'],
    ],
    extraObstacle: 'clam-rock',
    hideSpot: 'anemone',
    elements: [{ kind: 'bubble', count: 26, speed: 0.3 }],
  },
};

const DEFAULT_ENVIRONMENT_ID = 'emerald';

class EnvironmentScene {
  constructor(id = DEFAULT_ENVIRONMENT_ID) {
    this.id = ENVIRONMENT_DEFINITIONS[id] ? id : DEFAULT_ENVIRONMENT_ID;
    this.definition = ENVIRONMENT_DEFINITIONS[this.id];
    this.elements = [];
  }

  setEnvironment(id, widthLimit, heightLimit) {
    this.id = ENVIRONMENT_DEFINITIONS[id] ? id : DEFAULT_ENVIRONMENT_ID;
    this.definition = ENVIRONMENT_DEFINITIONS[this.id];
    document.body.dataset.environment = this.id;
    this.elements = [];
    for (const group of this.definition.elements) {
      for (let index = 0; index < group.count; index++) {
        this.elements.push(new EnvironmentElement(random(widthLimit), random(heightLimit), group));
      }
    }
  }

  createObstacles(widthLimit, heightLimit) {
    return this.definition.obstacles.map(([x, y, radius, kind]) =>
      new Obstacle(widthLimit * x, heightLimit * y, radius, kind));
  }

  patrolPath(widthLimit, heightLimit) {
    return this.definition.patrol.map(([x, y]) => createVector(widthLimit * x, heightLimit * y));
  }

  updateElements(widthLimit, heightLimit) {
    for (const element of this.elements) {
      element.steer();
      element.update();
      element.wrapInScene(widthLimit, heightLimit);
    }
  }

  showElements(now) {
    for (const element of this.elements) element.show(now);
  }

  drawBackground(widthLimit, heightLimit) {
    if (typeof WorldBackdrop !== 'undefined' &&
      WorldBackdrop.drawCached(this.id, this.definition, widthLimit, heightLimit)) return;
    this.drawFallbackBackground(widthLimit, heightLimit);
  }

  // Animation légère du relief (reflets d'eau, lave, vent, lumière sous-marine).
  drawAmbientMotion(widthLimit, heightLimit, now) {
    if (typeof WorldBackdrop === 'undefined') return;
    WorldBackdrop.drawAnimated(PaperArt.screen(), this.id, this.definition, widthLimit, heightLimit, now);
  }

  // Décor de secours sans tampon graphique : sol uni et bandes de relief.
  drawFallbackBackground(w, h) {
    const palette = this.definition.palette;
    noStroke();
    fill(palette.ground);
    rect(0, 0, w, h);
    palette.hills.forEach((color, index) => {
      fill(color);
      ellipse(w * (0.2 + index * 0.2), h * (0.3 + (index % 2) * 0.4), w * 0.3, h * 0.25);
    });
  }
}
