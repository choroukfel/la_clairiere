// ADN d'un esprit neuronal : les gènes de SteeringDNA (rayon de perception, vitesse
// de fuite…) plus les poids d'un NeuralNetwork. Même interface que SteeringDNA
// (copy, crossover, mutate) : EvolutionManager et la duplication le font évoluer
// sans traitement particulier.

// Entrées et sorties du cerveau des esprits (voir NeuralSpirit.senses()).
const SPIRIT_BRAIN = {
  inputs: [
    'threat',      // proximité du veilleur le plus proche (1 = au contact)
    'closing',     // vitesse de rapprochement du veilleur (−1..1)
    'player',      // proximité de la luciole du joueur, qui sauve au contact
    'playerSide',  // −1 : la luciole est à l'opposé du veilleur ; +1 : derrière lui
    'refuge',      // proximité d'un refuge actif
    'refugeSide',  // même mesure pour le refuge
    'crowd',       // voisins proches (0..1)
    'obstacle',    // proximité de l'obstacle le plus proche
    'speed',       // vitesse actuelle / vitesse maximale
    'endurance',   // endurance de fuite restante (0..1)
    'hideSpot',    // proximité de la meilleure cachette (derrière un obstacle, à l'opposé du veilleur)
    'hidden',      // 1 si un obstacle cache déjà l'esprit au veilleur le plus proche
    'rayFront',    // capteur à rayon devant (exemple 9) : proximité du premier obstacle ou veilleur
    'rayLeft',     // capteur à rayon à 45° à gauche
    'rayRight',    // capteur à rayon à 45° à droite
  ],
  hidden: 8,
  outputs: ['evade', 'separate', 'toPlayer', 'toRefuge', 'toHide'],
  // poids maximal de chaque comportement : (tanh + 1) / 2 ∈ [0, 1] × échelle
  scale: { evade: 3.5, separate: 2.5, toPlayer: 3, toRefuge: 3, toHide: 3 },
  mutationRate: 0.1,
};

class NeuralSteeringDNA extends SteeringDNA {
  constructor(genes = null, brain = null) {
    super(genes);
    this.brain = brain ? brain.copy() : new NeuralNetwork(null, NeuralSteeringDNA.sizes());
  }

  static sizes() {
    return [SPIRIT_BRAIN.inputs.length, SPIRIT_BRAIN.hidden, SPIRIT_BRAIN.outputs.length];
  }

  // ADN classique → ADN neuronal (cerveau aléatoire), utile si une évolution mixte
  // donne un ADN sans cerveau à un esprit neuronal.
  static from(dna) {
    if (dna instanceof NeuralSteeringDNA) return dna;
    return new NeuralSteeringDNA(dna?.genes ?? null);
  }

  copy() {
    return new NeuralSteeringDNA(this.genes, this.brain);
  }

  crossover(partner) {
    const child = super.crossover(partner);
    const brain = partner.brain ? this.brain.crossover(partner.brain) : this.brain.copy();
    return new NeuralSteeringDNA(child.genes, brain);
  }

  // Mutation en place, comme SteeringDNA.mutate : gènes puis poids du réseau.
  mutate(rate = 0.08) {
    super.mutate(rate);
    this.brain.mutate(Math.max(rate, SPIRIT_BRAIN.mutationRate * 0.5));
    return this;
  }

  toJSON() {
    return { genes: { ...this.genes }, brain: this.brain.toJSON() };
  }

  static fromJSON(data) {
    return new NeuralSteeringDNA(data.genes, NeuralNetwork.fromJSON(data.brain));
  }

  static isCompatible(data) {
    const weights = data?.brain?.weights;
    if (!weights || weights.length !== 2) return false;
    const [inputs, hidden, outputs] = NeuralSteeringDNA.sizes();
    return weights[0].length === hidden && weights[0][0].length === inputs + 1 && weights[1].length === outputs;
  }
}
