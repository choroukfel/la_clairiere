/*
 * Modèles d'évolution (ce ne sont pas des entités du monde) : ADN des steering
 * behaviors, gestionnaire d'évolution, ADN de trajectoire, population génétique
 * et réseau neuronal. Les entités correspondantes ont chacune leur fichier :
 * geneticRocket.js, migratingWisp.js ; sensorRay.js est une perception.
 */
class SteeringDNA {
  constructor(genes = null) {
    this.genes = genes ? { ...genes } : {
      fearWeight: random(0.9, 2.1),
      separationWeight: random(0.65, 1.7),
      cohesionWeight: random(0.05, 0.35),
      perceptionRadius: random(130, 220),
      escapeSpeed: random(2.8, 4.6),
    };
    this.clamp();
  }

  clamp() {
    this.genes.fearWeight = constrain(Number(this.genes.fearWeight) || 0, 0, 3.5);
    this.genes.separationWeight = constrain(Number(this.genes.separationWeight) || 0, 0, 3.5);
    this.genes.cohesionWeight = constrain(Number(this.genes.cohesionWeight) || 0, 0, 1.5);
    this.genes.perceptionRadius = constrain(Number(this.genes.perceptionRadius) || 130, 60, 300);
    this.genes.escapeSpeed = constrain(Number(this.genes.escapeSpeed) || 2.8, 1, 6);
    return this;
  }

  copy() { return new SteeringDNA(this.genes); }

  crossover(partner) {
    const child = {};
    for (const key of Object.keys(this.genes)) {
      child[key] = random() < 0.5 ? this.genes[key] : partner.genes[key];
    }
    return new SteeringDNA(child);
  }

  mutate(rate = 0.08) {
    const changes = {
      fearWeight: 0.28,
      separationWeight: 0.25,
      cohesionWeight: 0.12,
      perceptionRadius: 18,
      escapeSpeed: 0.3,
    };
    for (const [key, amount] of Object.entries(changes)) {
      if (random() < rate) this.genes[key] += random(-amount, amount);
    }
    return this.clamp();
  }
}

class EvolutionManager {
  constructor({ intervalMs = 30000, mutationRate = 0.12 } = {}) {
    this.intervalMs = intervalMs;
    this.mutationRate = mutationRate;
    this.generation = 1;
    this.lastGenerationAt = null;
    this.enabled = true;
    this.lastStats = { population: 0, bestFitness: 0, meanFitness: 0 };
  }

  update(targets, now) {
    const wild = targets.filter(target => !target.playerControlled);
    for (const target of wild) {
      target.fitnessScore = (target.fitnessScore || 0) + (1 / 60) + (target.threatLevel || 0) * 0.025;
    }
    if (!this.enabled || wild.length < 2) return false;
    if (this.lastGenerationAt === null) this.lastGenerationAt = now;
    if (now - this.lastGenerationAt < this.intervalMs) return false;
    this.evolve(wild);
    this.lastGenerationAt = now;
    this.generation++;
    return true;
  }

  selectParent(population) {
    if (!population.length) return null;
    // Tournoi : les individus les plus performants sont favorisés sans exclure
    // totalement la diversité génétique.
    const sample = Array.from({ length: Math.min(3, population.length) }, () =>
      population[Math.floor(random(population.length))]);
    return sample.reduce((best, item) => (item.fitnessScore || 0) > (best.fitnessScore || 0) ? item : best);
  }

  evolve(population) {
    const ranked = [...population].sort((a, b) => (b.fitnessScore || 0) - (a.fitnessScore || 0));
    const eliteCount = Math.max(1, Math.ceil(ranked.length * 0.2));
    const parents = ranked.slice(0, Math.max(2, eliteCount));
    const scores = ranked.map(item => Math.max(0, item.fitnessScore || 0));
    this.lastStats = {
      population: ranked.length,
      bestFitness: scores.length ? Math.max(...scores) : 0,
      meanFitness: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0,
    };

    for (let index = eliteCount; index < ranked.length; index++) {
      const first = this.selectParent(parents);
      const second = this.selectParent(parents);
      const child = first.dna.crossover(second.dna).mutate(this.mutationRate);
      ranked[index].dna = child;
      ranked[index].fitnessScore = 0;
      ranked[index].applyDNA?.();
    }
    for (let index = 0; index < eliteCount; index++) ranked[index].fitnessScore = 0;
  }

  resetClock(now = null) { this.lastGenerationAt = now; }
}

// ADN de trajectoire (inspiré de l'exercice « missiles génétiques »).
class TrajectoryDNA {
  constructor(genes = null, length = 210, maxForce = 0.18) {
    this.maxForce = maxForce;
    this.genes = genes
      ? genes.map(gene => gene.copy())
      : Array.from({ length }, () => p5.Vector.fromAngle(random(TWO_PI)).mult(random(0, maxForce)));
  }

  crossover(partner) {
    const pivot = Math.floor(random(this.genes.length));
    const genes = this.genes.map((gene, index) =>
      (index < pivot ? partner.genes[index] : gene).copy());
    return new TrajectoryDNA(genes, genes.length, this.maxForce);
  }

  mutate(rate = 0.015) {
    for (let index = 0; index < this.genes.length; index++) {
      if (random() < rate) {
        this.genes[index] = p5.Vector.fromAngle(random(TWO_PI)).mult(random(0, this.maxForce));
      }
    }
    return this;
  }
}

// Population de l'algorithme génétique (exemple 10) : sélection proportionnelle à la fitness,
// croisement, mutation et élitisme (le meilleur est recopié). spawn() donne le point de
// départ ; create(x, y, dna) fabrique un individu (GeneticRocket par défaut, MigratingWisp
// pour les feux follets du jeu).
class GeneticPopulation {
  constructor({ size = 34, lifetime = 210, mutationRate = 0.025,
    spawn = () => ({ x: width / 2, y: height * 0.84 }),
    create = (x, y, dna) => new GeneticRocket(x, y, dna) } = {}) {
    this.size = size;
    this.lifetime = lifetime;
    this.mutationRate = mutationRate;
    this.spawn = spawn;
    this.create = create;
    this.generation = 1;
    this.frame = 0;
    this.bestFitness = 0;
    this.bestReached = false;
    this.rockets = [];
    this.reset();
  }

  reset() {
    this.frame = 0;
    this.rockets = Array.from({ length: this.size }, () => this.birth(null));
  }

  birth(dna) {
    const point = this.spawn();
    return this.create(point.x, point.y, dna);
  }

  step(target, obstacles, hazards = []) {
    this.frame++;
    for (const rocket of this.rockets) rocket.step(target, obstacles, this.lifetime, hazards);
    if (this.frame >= this.lifetime || this.rockets.every(rocket => rocket.finished)) this.nextGeneration();
  }

  nextGeneration() {
    for (const rocket of this.rockets) rocket.calcFitness();
    const ranked = [...this.rockets].sort((a, b) => b.fitness - a.fitness);
    this.bestFitness = ranked[0]?.fitness || 0;
    this.bestReached = this.bestReached || ranked.some(rocket => rocket.hitTarget);
    const elite = ranked[0];
    const next = [this.birth(new TrajectoryDNA(elite.dna.genes, elite.dna.genes.length, elite.dna.maxForce))];
    const total = ranked.reduce((sum, rocket) => sum + rocket.fitness, 0);
    const pick = () => {
      if (total <= 0) return ranked[Math.floor(random(ranked.length))];
      let threshold = random(total);
      for (const rocket of ranked) {
        threshold -= rocket.fitness;
        if (threshold <= 0) return rocket;
      }
      return ranked[0];
    };
    while (next.length < this.size) {
      const parentA = pick();
      const parentB = pick();
      const childDNA = parentA.dna.crossover(parentB.dna).mutate(this.mutationRate);
      next.push(this.birth(childDNA));
    }
    this.rockets = next;
    this.frame = 0;
    this.generation++;
  }
}

// Réseau neuronal dense à une couche cachée (tanh partout), avec croisement et
// mutation des poids : il évolue par neuroévolution, sans rétropropagation.
// Tailles par défaut : 4 entrées, 6 neurones cachés, 2 sorties ; les esprits neuronaux
// utilisent leurs propres tailles (voir neuralSteeringDNA.js).
// weights[0] : sizes[1] lignes de sizes[0] + 1 poids (biais en colonne 0) ;
// weights[1] : sizes[2] lignes de sizes[1] + 1 poids.
class NeuralNetwork {
  constructor(weights = null, sizes = [4, 6, 2]) {
    const shape = weights ? [weights[0][0].length - 1, weights[0].length, weights[1].length] : sizes;
    [this.inputCount, this.hiddenCount, this.outputCount] = shape;
    this.weights = weights ? weights.map(layer => layer.map(row => [...row])) : [
      Array.from({ length: this.hiddenCount }, () => Array.from({ length: this.inputCount + 1 }, () => random(-1, 1))),
      Array.from({ length: this.outputCount }, () => Array.from({ length: this.hiddenCount + 1 }, () => random(-1, 1))),
    ];
  }

  sizes() {
    return [this.inputCount, this.hiddenCount, this.outputCount];
  }

  forward(inputs) {
    if (inputs.length !== this.inputCount) {
      throw new Error(`Le réseau attend ${this.inputCount} entrées, reçu ${inputs.length}`);
    }
    const hidden = this.weights[0].map(row => Math.tanh(row[0] + inputs.reduce((sum, value, index) => sum + value * row[index + 1], 0)));
    return this.weights[1].map(row => Math.tanh(row[0] + hidden.reduce((sum, value, index) => sum + value * row[index + 1], 0)));
  }

  copy() {
    return new NeuralNetwork(this.weights);
  }

  crossover(partner) {
    if (partner.sizes().join() !== this.sizes().join()) {
      throw new Error('Croisement impossible entre réseaux de tailles différentes');
    }
    const child = this.weights.map((layer, layerIndex) => layer.map((row, rowIndex) => row.map((weight, colIndex) =>
      random() < 0.5 ? weight : partner.weights[layerIndex][rowIndex][colIndex])));
    return new NeuralNetwork(child);
  }

  mutate(rate = 0.06) {
    for (const layer of this.weights) for (const row of layer) for (let index = 0; index < row.length; index++) {
      if (random() < rate) row[index] = constrain(row[index] + random(-0.25, 0.25), -2.5, 2.5);
    }
    return this;
  }

  toJSON() {
    return { weights: this.weights.map(layer => layer.map(row => [...row])) };
  }

  static fromJSON(data) {
    return new NeuralNetwork(data.weights);
  }
}
