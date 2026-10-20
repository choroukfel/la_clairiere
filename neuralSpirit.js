// Esprit sauvage dont la fuite est dosée par un réseau de neurones.
// Les trois niveaux de Reynolds restent séparés :
//  1. sélection de l'action (think → decide) : la perception locale est résumée en
//     entrées normalisées ; le réseau en déduit le poids de chaque comportement ;
//  2. steering (steer → fleeForces) : evade, séparation, seek vers la luciole, arrive
//     vers un refuge, hide derrière un obstacle (les veilleurs perçoivent par ligne de vue)
//     et évitement d'obstacles, combinés par somme pondérée ;
//  3. locomotion : update() hérité de Vehicle, appelé une fois par image par la scène.
// Hors fuite (errance, groupe), l'esprit se comporte comme un FleeTarget classique.
// Le réseau peut apprendre qu'un esprit poursuivi survit mieux en courant vers la
// luciole du joueur (qui le sauve au contact) ou vers un refuge qu'en fuyant tout droit.
class NeuralSpirit extends FleeTarget {
  static PLAYER_RANGE = 320;
  static REFUGE_RANGE = 360;
  static OBSTACLE_RANGE = 120;
  static HIDE_RANGE = 220;
  static RAY_LENGTH = 140;
  static CROWD_RADIUS = 64;

  constructor(x, y, speed = 1.4, playerControlled = false, dna = null) {
    super(x, y, speed, playerControlled, dna);
    this.dna = NeuralSteeringDNA.from(this.dna);
    // temps passé en fuite (ms) : base de la fitness, mesuré avec le temps écoulé
    this.threatenedMs = 0;
    this.brainOutputs = SPIRIT_BRAIN.outputs.map(() => 0);
    this.brainWeights = NeuralSpirit.zeroWeights();
    this.perceived = { player: null, refuge: null };
    // capteurs à rayons (exemple 9) : devant, 45° à gauche, 45° à droite
    this.sensors = [0, -Math.PI / 4, Math.PI / 4].map(offset => new SensorRay(offset, NeuralSpirit.RAY_LENGTH));
    this.rayReadings = [0, 0, 0];
  }

  static zeroWeights() {
    return Object.fromEntries(SPIRIT_BRAIN.outputs.map(name => [name, 0]));
  }

  static proximity(distance, range) {
    if (!Number.isFinite(distance) || range <= 0) return 0;
    return constrain(1 - distance / range, 0, 1);
  }

  // sortie tanh ∈ [−1, 1] → poids ∈ [0, échelle]
  static weightsFromOutputs(outputs) {
    const weights = {};
    SPIRIT_BRAIN.outputs.forEach((name, index) => {
      weights[name] = (outputs[index] + 1) / 2 * SPIRIT_BRAIN.scale[name];
    });
    return weights;
  }

  // Après une évolution mixte, un esprit neuronal peut recevoir un ADN sans cerveau.
  applyDNA() {
    this.dna = NeuralSteeringDNA.from(this.dna);
    super.applyDNA();
  }

  // 1. Sélection de l'action : perception et mode de FleeTarget, puis, en fuite,
  // décision du réseau. Le temps de fuite est mesuré avec le temps écoulé
  // (borné à 100 ms, pour qu'une pause ne compte pas).
  think(ships, now, context = {}) {
    const captured = super.think(ships, now, context);
    if (this.mode === 'flee') {
      this.threatenedMs += this.elapsedMs;
      this.senseRays(ships, context);
      this.decide(context);
    } else {
      this.brainWeights = NeuralSpirit.zeroWeights();
    }
    return captured;
  }

  // repère le plus proche dans une portée donnée, ou null
  nearestWithin(items, range) {
    let best = null;
    for (const item of items || []) {
      if (!item || item === this || !item.pos) continue;
      const distance = p5.Vector.dist(this.pos, item.pos);
      if (distance <= range && (!best || distance < best.distance)) best = { item, distance };
    }
    return best;
  }

  // Entrées du réseau, dans l'ordre de SPIRIT_BRAIN.inputs, toutes bornées dans [−1, 1].
  // Lit le veilleur perçu par think() (this.nearest) et les repères du contexte.
  senses({ neighbors = [], obstacles = [], player: playerCandidate = null, sanctuaries = [] } = {}) {
    const nearest = this.nearest;
    const radius = this.dna.genes.perceptionRadius;
    const toThreat = p5.Vector.sub(nearest.ship.pos, this.pos);
    const threatDirection = nearest.distance > 0.001 ? toThreat.copy().div(nearest.distance) : createVector(0, 0);
    const relative = p5.Vector.sub(nearest.ship.vel, this.vel);
    const closing = constrain(-relative.dot(threatDirection) / Math.max(nearest.ship.maxSpeed || 1, 0.001), -1, 1);
    // cosinus entre la direction d'un repère et celle du veilleur
    const side = found => {
      if (!found || found.distance < 0.001) return 0;
      const toItem = p5.Vector.sub(found.item.pos, this.pos).div(found.distance);
      return constrain(toItem.dot(threatDirection), -1, 1);
    };

    const player = playerCandidate?.playerControlled
      ? this.nearestWithin([playerCandidate], NeuralSpirit.PLAYER_RANGE)
      : null;
    const refuge = this.nearestWithin(sanctuaries, NeuralSpirit.REFUGE_RANGE);
    const spot = SteeringBehaviors.hidingSpot(this, nearest.ship, obstacles);
    const hideSpot = spot && spot.distance <= NeuralSpirit.HIDE_RANGE ? spot : null;
    const hidden = !SteeringBehaviors.lineOfSight(nearest.ship.pos, this.pos, obstacles);
    this.perceived = { player, refuge, hideSpot, hidden };

    const crowd = (neighbors || []).filter(other => other !== this
      && p5.Vector.dist(this.pos, other.pos) < NeuralSpirit.CROWD_RADIUS).length;
    let obstacleGap = Infinity;
    for (const obstacle of obstacles || []) {
      obstacleGap = Math.min(obstacleGap, Math.max(0, p5.Vector.dist(this.pos, obstacle.pos) - obstacle.r));
    }

    return [
      NeuralSpirit.proximity(nearest.distance, radius),
      closing,
      NeuralSpirit.proximity(player?.distance, NeuralSpirit.PLAYER_RANGE),
      side(player),
      NeuralSpirit.proximity(refuge?.distance, NeuralSpirit.REFUGE_RANGE),
      side(refuge),
      Math.min(1, crowd / 4),
      NeuralSpirit.proximity(obstacleGap, NeuralSpirit.OBSTACLE_RANGE),
      this.maxSpeed > 0 ? constrain(this.vel.mag() / this.maxSpeed, 0, 1) : 0,
      this.escape.endurance,
      NeuralSpirit.proximity(hideSpot?.distance, NeuralSpirit.HIDE_RANGE),
      hidden ? 1 : 0,
      ...this.rayReadings,
    ];
  }

  // Capteurs à rayons : obstacles et veilleurs sont les dangers ; la scène boucle sur
  // ses bords, qui ne sont donc pas des dangers.
  senseRays(ships = [], { obstacles = [] } = {}) {
    const dangers = [...obstacles, ...ships.map(ship => ({ pos: ship.pos, r: (ship.r || 0) + 6 }))];
    this.rayReadings = this.sensors.map(sensor => {
      sensor.sense(this, dangers, { bounded: false });
      return sensor.proximity();
    });
    return this.rayReadings;
  }

  // Le réseau fixe les poids des comportements de fuite (appelé par think()).
  decide(context = {}) {
    this.brainOutputs = this.dna.brain.forward(this.senses(context));
    this.brainWeights = NeuralSpirit.weightsFromOutputs(this.brainOutputs);
    return this.brainWeights;
  }

  // 2. Steering : comportements existants, pondérés par la décision prise dans think().
  fleeForces({ neighbors = [], obstacles = [] } = {}) {
    const nearest = this.nearest;
    const w = this.brainWeights;
    const forces = [
      { force: SteeringBehaviors.evade(this, nearest.ship), weight: w.evade },
      { force: SteeringBehaviors.separate(this, neighbors, NeuralSpirit.CROWD_RADIUS), weight: w.separate },
      { force: SteeringBehaviors.avoidObstacle(this, nearest.ship, obstacles), weight: 1.8 },
    ];
    const { player, refuge } = this.perceived;
    if (player) forces.push({ force: SteeringBehaviors.seek(this, player.item.pos), weight: w.toPlayer });
    if (refuge) forces.push({ force: SteeringBehaviors.arrive(this, refuge.item.pos, refuge.item.r), weight: w.toRefuge });
    const { hideSpot } = this.perceived;
    if (hideSpot) forces.push({ force: SteeringBehaviors.arrive(this, hideSpot.point, 40), weight: w.toHide });
    return forces;
  }
}
