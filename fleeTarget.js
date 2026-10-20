// Esprit à sauver : il fuit le veilleur le plus proche et peut se dupliquer.
// Seule la couleur de halo dépend de l'espèce ; le dessin vient de CreatureArt.
const SPIRIT_ART = {
  firefly: { glow: [188, 231, 151] },
  bee: { glow: [255, 224, 110] },
  fox: { glow: [255, 170, 100] },
  rabbit: { glow: [255, 226, 190] },
  ember: { glow: [255, 140, 50] },
  bird: { glow: [150, 205, 255] },
  fish: { glow: [102, 218, 224] },
};

class FleeTarget extends Vehicle {
  static DETECTION_RADIUS = 44;
  static FLEE_RADIUS = 190;
  static PURSUIT_SPEED_BONUS = 4.4;
  static ESCAPE_FORCE_MULTIPLIER = 2.4;
  static ESCAPE_TIME_MS = 2000;
  static DUPLICATION_FORM_MS = 850;
  static DUPLICATION_HOLD_MS = 900;
  static DUPLICATION_SEPARATION = 108;

  constructor(x, y, speed = 1.4, playerControlled = false, dna = null) {
    super(x, y);
    this.dna = dna instanceof SteeringDNA ? dna.copy() : new SteeringDNA(dna);
    this.fitnessScore = 0;
    this.r = 12;
    this.maxForce = 0.18;
    this.baseMaxForce = this.maxForce;
    this.automaticSpeed = speed;
    this.maxSpeed = speed;
    this.manualSpeed = 3.5;
    this.playerControlled = playerControlled;
    this.spiritKind = 'firefly';
    this.wanderHeading = random(TWO_PI);
    this.escapeStartedAt = null;
    this.hasDuplicated = false;
    this.mode = 'wander';
    this.nearest = null;
    // fuite réglementée : déclenchement, distance de sécurité, endurance, épuisement
    this.escape = new SpiritEscape();
    this.escapeTransition = null;
    this.heardCall = null;
    this.lastThinkAt = null;
    this.elapsedMs = 0;
  }

  // rayon de déclenchement de la fuite (gène de perception pour un esprit)
  get detectionRadius() {
    return this.playerControlled ? FleeTarget.FLEE_RADIUS : this.dna.genes.perceptionRadius;
  }

  // distance de sécurité : il faut s'éloigner au-delà pour sortir de la fuite
  get exitDistance() {
    return this.detectionRadius + SpiritEscape.SAFETY_MARGIN;
  }

  // transition de scénario (changement de lieu, nouveau niveau) : la fuite repart de zéro,
  // les limites normales sont restaurées, la population n'est pas recréée
  resetEscape() {
    this.escape.reset();
    this.escapeTransition = null;
    this.escapeStartedAt = null;
    if (!this.playerControlled) {
      this.maxSpeed = this.automaticSpeed;
      this.maxForce = this.baseMaxForce;
    }
    this.mode = 'wander';
  }

  // Pas de remise à zéro directe : la locomotion de Vehicle borne la vitesse
  // à maxSpeed dès l'image suivante.
  setSpeed(speed) {
    this.automaticSpeed = Math.max(0, Number(speed) || 0);
    this.maxSpeed = this.automaticSpeed;
  }

  setManualSpeed(speed) {
    this.manualSpeed = Math.max(0, Number(speed) || 0);
  }

  duplicateAt(x, y) {
    const childDNA = this.dna.copy().mutate(0.14);
    // même classe que le parent : un esprit neuronal donne un esprit neuronal
    const duplicate = new this.constructor(x, y, this.automaticSpeed, false, childDNA);
    duplicate.setSpiritKind(this.spiritKind);
    duplicate.setManualSpeed(this.manualSpeed);

    // Condition de naissance (pas un pilotage) : le double part en s'éloignant du parent.
    const departure = p5.Vector.sub(duplicate.pos, this.pos);
    if (departure.magSq() < 0.001) departure.set(random(-1, 1), random(-1, 1));
    if (this.automaticSpeed > 0) departure.setMag(Math.min(this.automaticSpeed, 2.5));
    else departure.set(0, 0);
    duplicate.vel.set(departure);
    return duplicate;
  }

  applyDNA() {
    this.dna.clamp();
    if (!this.playerControlled && this.escapeStartedAt !== null) {
      this.maxSpeed = this.automaticSpeed + Math.max(FleeTarget.PURSUIT_SPEED_BONUS, this.dna.genes.escapeSpeed);
    }
  }

  setSpiritKind(kind) {
    this.spiritKind = SPIRIT_ART[kind] ? kind : 'firefly';
  }

  // Les trois niveaux de Reynolds sont séparés et appelés par la scène (sketch.js) :
  //  1. think(ships, now, context) : perception, choix du mode, limites temporaires ;
  //  2. steer(context) : forces du mode choisi, appliquées par applyForce ;
  //  3. update() puis edges() : locomotion héritée de Vehicle, une fois par image.
  // context : { pointerGoal, neighbors, obstacles, player, sanctuaries, call }.

  // 1. Perception et sélection de l'action. Renvoie true si un veilleur est dans
  // le cercle de capture.
  think(ships, now, context = {}) {
    // temps écoulé depuis la dernière image, borné (une pause ne compte pas)
    this.elapsedMs = this.lastThinkAt === null ? 0 : constrain(now - this.lastThinkAt, 0, 100);
    this.lastThinkAt = now;
    this.escapeTransition = null;
    // Une duplication en cours va jusqu'au bout, même si un veilleur traverse le
    // cercle de détection pendant l'animation : l'esprit freine sur place.
    if (this.duplicationStartedAt !== undefined) {
      this.mode = 'duplicating';
      return false;
    }

    const nearest = this.findNearestShip(ships);
    this.nearest = nearest;
    const perceptionRadius = this.detectionRadius;
    this.threatLevel = nearest
      ? constrain(1 - nearest.distance / perceptionRadius, 0, 1)
      : 0;
    if (nearest && nearest.distance <= FleeTarget.DETECTION_RADIUS) {
      this.mode = 'captured';
      return true;
    }

    // La lumière guidée répond toujours à la souris ; les esprits sauvages
    // fuient quand un veilleur entre dans leur rayon de perception.
    if (this.playerControlled) {
      const boosted = now < (this.speedBoostUntil || 0);
      this.maxSpeed = this.manualSpeed * (boosted ? 1.7 : 1);
      this.maxForce = this.baseMaxForce * (boosted ? 1.2 : 1);
    }
    if (this.playerControlled && context.pointerGoal) {
      this.escapeStartedAt = null;
      this.mode = 'guided';
      return false;
    }

    // Fuite réglementée : déclenchée dans le rayon de perception, poursuivie tant que le
    // veilleur le plus proche n'est pas à la distance de sécurité, bornée par l'endurance.
    this.escapeTransition = this.escape.update(this.elapsedMs, nearest ? nearest.distance : Infinity,
      this.detectionRadius, this.exitDistance);
    if (this.escape.isFleeing()) {
      this.maxSpeed = this.automaticSpeed + Math.max(FleeTarget.PURSUIT_SPEED_BONUS, this.dna.genes.escapeSpeed);
      this.maxForce = this.baseMaxForce * FleeTarget.ESCAPE_FORCE_MULTIPLIER;
      if (this.escapeStartedAt === null) this.escapeStartedAt = now;
      this.mode = 'flee';
    } else {
      // Sortie de fuite ou épuisement : limites normales restaurées exactement.
      // La cible doit être poursuivie sans interruption pendant 2 s pour gagner une
      // duplication ; une pause de la poursuite remet le délai à zéro.
      this.escapeStartedAt = null;
      this.maxSpeed = this.automaticSpeed;
      this.maxForce = this.baseMaxForce;
      // perception auditive : un esprit sauvage qui entend l'appel de la luciole la rejoint
      const call = context.call;
      this.heardCall = !this.playerControlled && call && call.isActive(now) && call.hears(this) ? call : null;
      this.mode = this.heardCall ? 'called' : 'wander';
    }
    return false;
  }

  // 2. Steering : forces du mode choisi par think(), combinées puis appliquées.
  steer(context = {}) {
    const { pointerGoal = null, neighbors = [], obstacles = [] } = context;
    let forces;
    if (this.mode === 'duplicating') {
      forces = [{ force: SteeringBehaviors.brake(this), weight: 1 }];
    } else if (this.mode === 'guided') {
      forces = [
        { force: SteeringBehaviors.arrive(this, pointerGoal, 90, this.manualSpeed), weight: 1 },
        { force: SteeringBehaviors.avoidObstacle(this, pointerGoal, obstacles), weight: 1.8 },
      ];
    } else if (this.mode === 'flee') {
      forces = this.fleeForces(context);
    } else if (this.mode === 'called') {
      forces = [
        { force: SteeringBehaviors.arrive(this, this.heardCall.pos, 70), weight: 1.2 },
        { force: SteeringBehaviors.separate(this, neighbors, 70), weight: 1.15 },
        { force: SteeringBehaviors.avoidObstacle(this, this.heardCall.pos, obstacles), weight: 2 },
      ];
    } else if (this.mode === 'wander') {
      forces = [
        { force: SteeringBehaviors.wander(this), weight: 1 },
        { force: SteeringBehaviors.separate(this, neighbors, 70), weight: 1.15 },
        { force: SteeringBehaviors.align(this, neighbors, 115), weight: 0.22 },
        { force: SteeringBehaviors.cohesion(this, neighbors, 145), weight: this.dna.genes.cohesionWeight },
        { force: SteeringBehaviors.avoidObstacle(this, pointerGoal ?? this.pos, obstacles), weight: 2 },
      ];
    } else {
      return;
    }
    this.applyForce(SteeringBehaviors.combine(this, forces));
  }

  // Forces de fuite pondérées par l'ADN, face au veilleur perçu par think() ;
  // une sous-classe peut choisir d'autres poids.
  fleeForces({ neighbors = [], obstacles = [] } = {}) {
    const ship = this.nearest.ship;
    return [
      { force: SteeringBehaviors.evade(this, ship), weight: this.dna.genes.fearWeight },
      { force: SteeringBehaviors.separate(this, neighbors, 64), weight: this.dna.genes.separationWeight },
      { force: SteeringBehaviors.avoidObstacle(this, ship, obstacles), weight: 1.8 },
    ];
  }

  findNearestShip(ships) {
    let nearest = null;
    let nearestDistanceSquared = Infinity;
    for (const ship of ships) {
      const distanceSquared = p5.Vector.sub(ship.pos, this.pos).magSq();
      if (distanceSquared < nearestDistanceSquared) {
        nearest = ship;
        nearestDistanceSquared = distanceSquared;
      }
    }
    return nearest ? { ship: nearest, distance: Math.sqrt(nearestDistanceSquared) } : null;
  }

  shouldDuplicate(now) {
    return !this.hasDuplicated && this.escapeStartedAt !== null &&
      now - this.escapeStartedAt >= FleeTarget.ESCAPE_TIME_MS;
  }

  // Début de la duplication : rien n'est déplacé ici. L'esprit freine par steering
  // (mode « duplicating ») et son double naîtra à côté de lui, du côté où il reste
  // de la place dans la scène.
  beginDuplicationAnimation(now) {
    const separation = Math.min(
      FleeTarget.DUPLICATION_SEPARATION,
      Math.max(0, width - this.r * 2)
    );
    const side = this.pos.x + separation <= width - this.r ? 1 : -1;
    this.duplicationOffset = createVector(side * separation, 0);
    this.duplicationStartedAt = now;
  }

  // Fin de l'animation : renvoie la position de naissance du double (règle de scène).
  completeDuplicationAnimation(now) {
    if (this.duplicationStartedAt === undefined) return null;

    const totalDuration = FleeTarget.DUPLICATION_FORM_MS + FleeTarget.DUPLICATION_HOLD_MS;
    if (now - this.duplicationStartedAt < totalDuration) return null;

    const position = p5.Vector.add(this.pos, this.duplicationOffset);
    position.y = constrain(position.y, this.r, height - this.r);
    this.duplicationStartedAt = undefined;
    this.duplicationOffset = undefined;
    return position;
  }

  // Deux cercles de papier se forment puis se séparent : la duplication est lisible.
  showDuplicationAnimation(now, g = PaperArt.screen()) {
    if (this.duplicationStartedAt === undefined) return;

    const totalDuration = FleeTarget.DUPLICATION_FORM_MS + FleeTarget.DUPLICATION_HOLD_MS;
    const elapsed = Math.min(now - this.duplicationStartedAt, totalDuration);
    const formProgress = constrain(elapsed / FleeTarget.DUPLICATION_FORM_MS, 0, 1);
    const easedProgress = 1 - (1 - formProgress) ** 2;
    const diameter = this.r * 1.8 + (FleeTarget.DETECTION_RADIUS * 2 - this.r * 1.8) * easedProgress;
    const offset = (this.duplicationOffset ?? createVector(FleeTarget.DUPLICATION_SEPARATION, 0)).copy().mult(easedProgress);
    const alpha = elapsed < FleeTarget.DUPLICATION_FORM_MS
      ? 245
      : 245 - (elapsed - FleeTarget.DUPLICATION_FORM_MS) / FleeTarget.DUPLICATION_HOLD_MS * 170;
    const rotation = -HALF_PI + elapsed * 0.004;

    // un cercle sur l'esprit, l'autre glisse vers la place de son futur double
    for (const share of [0, 1]) {
      const centerX = constrain(this.pos.x + offset.x * share, this.r, width - this.r);
      g.push();
      g.translate(centerX, this.pos.y);
      g.noFill();
      g.strokeWeight(2.6);
      g.stroke(255, 248, 222, alpha);
      g.arc(0, 0, diameter, diameter, rotation, rotation + PI * easedProgress);
      g.stroke(255, 209, 102, alpha);
      g.arc(0, 0, diameter, diameter, rotation + PI, rotation + PI + PI * easedProgress);
      if (formProgress >= 1) {
        g.stroke(255, 255, 255, alpha * 0.7);
        g.strokeWeight(1.6);
        PaperArt.dashedCircle(g, 0, 0, diameter * 1.15, 16, elapsed * 0.003);
      }
      g.pop();
    }
  }

  show(now = millis(), g = PaperArt.screen()) {
    const art = SPIRIT_ART[this.spiritKind] ?? SPIRIT_ART.firefly;
    const speedRatio = this.maxSpeed > 0 ? constrain(this.vel.mag() / this.maxSpeed, 0, 1) : 0;
    const bob = Math.sin(now * (this.playerControlled ? 0.009 : 0.013) + this.wanderHeading) * (this.playerControlled ? 1.8 : 3.2);
    const threat = this.threatLevel ?? 0;
    g.push();
    if (this.playerControlled && now < (this.invisibilityUntil || 0) && g.drawingContext) g.drawingContext.globalAlpha = 0.4;

    // Cercle de capture : discret pour le joueur, plus chaud quand un veilleur approche.
    g.noFill();
    if (this.playerControlled) {
      g.stroke(255, 244, 194, 70);
      g.strokeWeight(1.4);
      PaperArt.dashedCircle(g, this.pos.x, this.pos.y, FleeTarget.DETECTION_RADIUS * 2, 20, now * 0.0006);
    } else if (threat > 0.04) {
      g.stroke(255, 120 + 80 * (1 - threat), 90, 40 + threat * 170);
      g.strokeWeight(1.4 + threat);
      PaperArt.dashedCircle(g, this.pos.x, this.pos.y, FleeTarget.DETECTION_RADIUS * 2, 16, -now * 0.002);
    }

    PaperArt.groundShadow(g, this.pos.x, this.pos.y + this.r * 1.25, this.r * 1.7, this.r * 0.45, 0.7);
    g.translate(this.pos.x, this.pos.y + bob);
    if (this.vel.x < -0.2) g.scale(-1, 1);
    g.rotate(constrain(this.vel.y, -3, 3) * 0.05 * (this.vel.x < -0.2 ? -1 : 1));
    g.scale(1 + speedRatio * 0.1, 1 - speedRatio * 0.06);
    if (this.playerControlled) {
      CreatureArt.drawAvatar(g, this.playerIcon || 'firefly', this.r, { now });
    } else {
      CreatureArt.drawSpirit(g, this.spiritKind, this.r, { now, phase: this.wanderHeading, glow: art.glow });
    }
    g.pop();
    this.showEndurance(g);
    this.showDuplicationAnimation(now, g);
  }

  // Barre d'endurance sous un esprit en fuite (dorée) ou épuisé (rouge, « zZ ») :
  // simple lecture de l'état de fuite, sans calcul de force.
  showEndurance(g = PaperArt.screen()) {
    if (this.playerControlled || this.escape.state === 'normal') return;
    const w = 26;
    const x = this.pos.x - w / 2;
    const y = this.pos.y + this.r * 1.75;
    const exhausted = this.escape.state === 'exhausted';
    g.push();
    g.noStroke();
    g.fill(24, 14, 30, 150);
    g.rect(x - 1, y - 1, w + 2, 6, 3);
    g.fill(exhausted ? '#ff6b6b' : '#ffd166');
    g.rect(x, y, w * this.escape.endurance, 4, 2);
    if (exhausted) {
      g.fill(255, 248, 230, 230);
      g.textAlign(CENTER, CENTER);
      g.textSize(10);
      g.text('zZ', this.pos.x + this.r * 1.3, this.pos.y - this.r * 1.4);
    }
    g.pop();
  }
}
