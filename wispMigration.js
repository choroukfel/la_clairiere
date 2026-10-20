// Migration des feux follets : contrôleur (pas une entité) de l'algorithme génétique du jeu.
// Un vol dure LIFETIME images ; à la fin, GeneticPopulation note chaque feu follet
// (proximité du nid, arrivée, collision), sélectionne, croise et mute les ADN, et la
// génération suivante s'envole. On voit ainsi, au fil de la partie, les feux follets apprendre
// à contourner obstacles et veilleurs. Chaque arrivée est signalée une fois (onArrival).
const WispMigration = {
  SIZE: 18,
  LIFETIME: 600,
  enabled: true,
  population: null,
  nest: null,
  start: null,
  arrivedThisFlight: 0,
  totalArrivals: 0,
  history: [],

  // positions de départ (bord gauche) et du nid (bord droit), au milieu de la hauteur
  layout(w, h) {
    return { start: createVector(Math.min(70, w * 0.08), h * 0.5), nest: createVector(Math.max(w - 80, w * 0.9), h * 0.5) };
  },

  reset(w = width, h = height) {
    const { start, nest } = this.layout(w, h);
    this.start = start;
    this.nest = new WispNest(nest.x, nest.y);
    this.population = new GeneticPopulation({
      size: this.SIZE,
      lifetime: this.LIFETIME,
      mutationRate: 0.008,
      spawn: () => ({ x: this.start.x, y: this.start.y + random(-14, 14) }),
      create: (x, y, dna) => new MigratingWisp(x, y, dna),
    });
    this.arrivedThisFlight = 0;
    this.totalArrivals = 0;
    this.history = [];
  },

  // changement de lieu ou de taille : les ADN appris sont gardés, le vol reprend au départ
  relocate(w = width, h = height) {
    if (!this.population) return this.reset(w, h);
    const { start, nest } = this.layout(w, h);
    this.start = start;
    this.nest.pos.set(nest.x, nest.y);
    this.population.rockets = this.population.rockets.map(wisp => this.population.birth(wisp.dna));
    this.population.frame = 0;
    this.arrivedThisFlight = 0;
  },

  // une image de vol ; onArrival(wisp) est appelé une fois par feu follet arrivé
  update(obstacles = [], hazards = [], onArrival = () => {}) {
    if (!this.enabled || !this.population) return;
    const generation = this.population.generation;
    this.population.step(this.nest, obstacles, hazards);
    if (this.population.generation !== generation) {
      this.history.push({ generation, arrived: this.arrivedThisFlight });
      if (this.history.length > 100) this.history.shift();
      this.arrivedThisFlight = 0;
      return;
    }
    for (const wisp of this.population.rockets) {
      if (!wisp.hitTarget || wisp.rewarded) continue;
      wisp.rewarded = true;
      this.arrivedThisFlight++;
      this.totalArrivals++;
      onArrival(wisp);
    }
  },

  best() {
    return this.history.reduce((max, entry) => Math.max(max, entry.arrived), 0);
  },

  status() {
    if (!this.population) return '';
    return `Feux follets · génération ${this.population.generation} · ${this.arrivedThisFlight} / ${this.SIZE} au nid`
      + ` (record ${Math.max(this.best(), this.arrivedThisFlight)})`;
  },

  show(now, g) {
    if (!this.enabled || !this.population) return;
    this.nest.show(now, g);
    for (const wisp of this.population.rockets) if (!wisp.finished || wisp.hitTarget) wisp.show(now, g);
  },
};
