// Mémoire des meilleurs cerveaux d'esprits (neuroévolution en continu).
// Chaque esprit neuronal qui quitte la partie — sauvé par la luciole ou attrapé
// par un veilleur — y dépose son ADN avec sa fitness. Les nouveaux esprits naissent
// d'un croisement de deux parents choisis par tournoi, puis d'une mutation.
class SpiritBrainPool {
  // fitness = secondes de fuite survécues + bonus si l'esprit a été sauvé
  static RESCUE_BONUS = 10;

  // decay : à chaque ajout, les scores déjà mémorisés sont multipliés par ce facteur.
  // Un esprit chanceux une seule fois finit par céder sa place : le réservoir suit
  // les performances récentes au lieu de se figer sur un record isolé.
  constructor(size = 12, mutationRate = 0.1, decay = 0.97) {
    this.size = size;
    this.mutationRate = mutationRate;
    this.decay = decay;
    this.entries = [];
    this.rescued = 0;
    this.caught = 0;
    this.births = 0;
  }

  static fitness(spirit, rescued) {
    return spirit.threatenedMs / 1000 + (rescued ? SpiritBrainPool.RESCUE_BONUS : 0);
  }

  add(dna, fitness) {
    for (const entry of this.entries) entry.fitness *= this.decay;
    this.entries.push({ dna: dna.copy(), fitness: Math.max(0, fitness) });
    this.entries.sort((a, b) => b.fitness - a.fitness);
    this.entries.length = Math.min(this.entries.length, this.size);
  }

  // Bilan d'un esprit qui quitte la partie.
  record(spirit, rescued) {
    if (!(spirit.dna instanceof NeuralSteeringDNA)) return;
    if (rescued) this.rescued++;
    else this.caught++;
    this.add(spirit.dna, SpiritBrainPool.fitness(spirit, rescued));
  }

  // Tournoi à trois : favorise les meilleurs sans exclure la diversité.
  select() {
    const sample = Array.from({ length: Math.min(3, this.entries.length) }, () =>
      this.entries[Math.floor(random(this.entries.length))]);
    return sample.reduce((best, item) => (item.fitness > best.fitness ? item : best)).dna;
  }

  breed() {
    this.births++;
    if (this.entries.length < 2) return new NeuralSteeringDNA();
    return this.select().crossover(this.select()).mutate(this.mutationRate);
  }

  best() {
    return this.entries[0] ?? null;
  }

  rescueRate() {
    const total = this.rescued + this.caught;
    return total ? this.rescued / total : 0;
  }

  // Amorçage avec des cerveaux déjà évolués (spiritBrainPretrained.js).
  seed(pretrained) {
    if (!pretrained || !Array.isArray(pretrained.entries)) return 0;
    let added = 0;
    for (const entry of pretrained.entries) {
      if (!NeuralSteeringDNA.isCompatible(entry.dna)) continue;
      this.add(NeuralSteeringDNA.fromJSON(entry.dna), entry.fitness);
      added++;
    }
    return added;
  }
}
