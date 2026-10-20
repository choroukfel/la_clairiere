// Veilleur nocturne : steering et locomotion hérités de Vehicle.
class SeekVehicle extends Vehicle {
  static PURSUIT_RADIUS = 190;
  static PURSUIT_SPEED_MULTIPLIER = 1.4;
  // Chaque espèce de veilleur réutilise un mode de déplacement (rythme, anticipation).
  static MOTION_BY_KIND = {
    bramble: 'clockwork', 'frost-lynx': 'cat', 'dune-scorpion': 'mantis',
    'ash-moth': 'moth', 'storm-ray': 'moth', 'lantern-angler': 'shark',
  };
  // Dessin par défaut quand seul un mode de déplacement est fourni.
  static ART_BY_MOTION = {
    moth: 'ash-moth', shark: 'lantern-angler', mantis: 'dune-scorpion',
    clockwork: 'bramble', cat: 'frost-lynx', 'crystal-golem': 'bramble',
  };

  constructor(x, y, guardian = null) {
    super(x, y);
    this.cruiseSpeed = this.maxSpeed;
    this.accent = random(['#263f32', '#344b39', '#3b5141', '#2d4842']);
    this.guardianKind = 'moth';
    this.motionKind = 'moth';
    this.guardianColor = '#45634a';
    this.aiState = 'patrol';
    this.lastKnownPosition = null;
    this.lastSeenAt = 0;
    this.investigationDuration = 2600;
    this.investigationRadius = 24;
    this.patrolPhase = random(TWO_PI);
    this.motionPhase = random(TWO_PI);
    this.setGuardian(guardian);
  }

  setGuardian(guardian = null) {
    const config = guardian && typeof guardian === 'object' ? guardian : {};
    const supported = ['moth', 'shark', 'mantis', 'clockwork', 'cat', 'crystal-golem'];
    const speciesMotion = SeekVehicle.MOTION_BY_KIND[config.kind];
    this.guardianKind = (speciesMotion || supported.includes(config.kind)) ? config.kind : 'moth';
    this.motionKind = speciesMotion || (supported.includes(config.kind) ? config.kind : 'moth');
    this.guardianColor = config.color || '#45634a';
    this.aiState = 'patrol';
    this.lastKnownPosition = null;
    this.lastSeenAt = 0;
    const multiplier = Number.isFinite(config.speedMultiplier) ? config.speedMultiplier : 1;
    this.baseCruiseSpeed = 4 * Math.max(0.75, Math.min(1.2, multiplier));
    this.cruiseSpeed = this.baseCruiseSpeed;
    this.maxSpeed = this.cruiseSpeed;
    this.r = this.motionKind === 'crystal-golem' ? 15 : this.motionKind === 'shark' ? 14 : 13;
  }

  // Perception auditive : sans cible en poursuite, un veilleur qui entend un appel vient
  // enquêter à l'endroit du bruit (même mémoire que pour une cible perdue de vue).
  hear(call, now = millis()) {
    if (!call || !call.isActive(now) || this.aiState === 'chase' || !call.hears(this)) return false;
    this.aiState = 'investigate';
    this.lastKnownPosition = call.pos.copy();
    this.lastSeenAt = now;
    return true;
  }

  // Perception : la cible doit être dans le rayon de poursuite ET visible (aucun obstacle
  // entre le veilleur et elle). Une cible perdue de vue est cherchée à sa dernière position.
  chooseBehaviorTarget(candidates, now = millis(), level = 1, obstacles = []) {
    this.cruiseSpeed = this.baseCruiseSpeed * Math.min(1.3, 1 + Math.max(0, level - 1) * 0.025);
    const scaledRange = SeekVehicle.PURSUIT_RADIUS + Math.min(120, Math.max(0, level - 1) * 12);
    let visibleTarget = null;
    let nearestDistance = scaledRange * scaledRange;
    for (const candidate of candidates || []) {
      if (!candidate || !candidate.pos) continue;
      if (candidate.playerControlled && (candidate.isHidden || candidate.isSheltered ||
        now < (candidate.invisibilityUntil || 0) || now < (candidate.shieldUntil || 0))) continue;
      const distance = p5.Vector.sub(candidate.pos, this.pos).magSq();
      if (distance > nearestDistance) continue;
      if (!SteeringBehaviors.lineOfSight(this.pos, candidate.pos, obstacles)) continue;
      visibleTarget = candidate;
      nearestDistance = distance;
    }

    if (visibleTarget) {
      this.aiState = 'chase';
      this.lastKnownPosition = visibleTarget.pos.copy();
      this.lastSeenAt = now;
      return visibleTarget;
    }

    if (this.aiState === 'chase' && this.lastKnownPosition) this.aiState = 'investigate';
    if (this.aiState === 'investigate' && this.lastKnownPosition) {
      if (now - this.lastSeenAt <= this.investigationDuration &&
        p5.Vector.dist(this.pos, this.lastKnownPosition) > this.investigationRadius) {
        return { pos: this.lastKnownPosition, memoryTarget: true };
      }
      this.aiState = 'patrol';
      this.lastKnownPosition = null;
    }
    this.aiState = 'patrol';
    return null;
  }

  applyBehaviors(target, obstacles = [], sanctuaries = [], patrolPath = []) {
    const fallbackPoint = patrolPath?.length ? patrolPath[0] : this.pos;
    const destination = target?.pos ?? fallbackPoint;
    const distanceSquared = p5.Vector.sub(destination, this.pos).magSq();
    const pursuitRangeSquared = SeekVehicle.PURSUIT_RADIUS ** 2;
    const chasing = Boolean(target && !target.memoryTarget && distanceSquared <= pursuitRangeSquared);
    const now = millis();
    const rhythm = Math.sin(now * 0.004 + this.motionPhase);
    this.maxSpeed = this.cruiseSpeed * (chasing ? SeekVehicle.PURSUIT_SPEED_MULTIPLIER : 1);

    // Chaque veilleur possède une locomotion lisible, pas seulement une apparence différente.
    // Les variations sont continues et basées sur le temps pour rester fluides à tous les FPS.
    if (this.motionKind === 'shark') {
      this.maxSpeed *= chasing ? 1.08 : 0.84;
    } else if (this.motionKind === 'mantis') {
      this.maxSpeed *= chasing ? (rhythm > -0.15 ? 1.34 : 0.66) : 1.12;
    } else if (this.motionKind === 'clockwork') {
      this.maxSpeed *= 0.72 + (0.5 + 0.5 * Math.sin(now * 0.0032 + this.motionPhase)) * 0.52;
    } else if (this.motionKind === 'cat') {
      this.maxSpeed *= chasing ? (rhythm > 0.35 ? 1.55 : 0.72) : 0.88;
    } else if (this.motionKind === 'crystal-golem') {
      this.maxSpeed *= chasing ? 0.88 : 0.68;
    } else {
      this.maxSpeed *= chasing ? 1.12 : 0.94;
    }

    const refuge = this.avoidSanctuary(sanctuaries);
    if (refuge) {
      this.applyForce(refuge);
      return;
    }

    let steeringTarget = target || { pos: destination, vel: createVector(0, 0) };
    // Le chat et le requin calculent le point d'interception exact (poursuite parfaite) ;
    // les autres veilleurs utilisent la poursuite prédictive.
    const intercepts = this.motionKind === 'cat' || this.motionKind === 'shark';
    if (target && !target.memoryTarget && target.vel && intercepts) {
      const point = SteeringBehaviors.interceptPoint(this, target);
      if (point) steeringTarget = { pos: point, vel: target.vel };
      this.interceptTarget = point;
    } else {
      this.interceptTarget = null;
    }
    const avoidance = SteeringBehaviors.avoidObstacle(this, steeringTarget, obstacles);
    const pathForce = SteeringBehaviors.followPath(this, patrolPath);
    let pursuit = SteeringBehaviors.wander(this, 0.025);
    if (target && target.memoryTarget) pursuit = SteeringBehaviors.arrive(this, destination, 46);
    else if (target && intercepts) pursuit = SteeringBehaviors.pursuePerfect(this, target);
    else if (target) pursuit = SteeringBehaviors.pursue(this, steeringTarget);
    const forces = [
      { force: pursuit || SteeringBehaviors.wander(this, 0.025), weight: target?.memoryTarget ? 1.15 : 1 },
      { force: avoidance, weight: this.motionKind === 'crystal-golem' ? 3.1 : 2.4 },
      { force: pathForce, weight: target ? 0.12 : (this.motionKind === 'moth' ? 0.48 : 0.72) },
    ];

    // Ondulation de nage, zigzag d'embuscade et balancement mécanique bien visibles.
    const toGoal = p5.Vector.sub(destination, this.pos);
    if (toGoal.magSq() > 0.001 && (this.motionKind === 'shark' || this.motionKind === 'mantis' || this.motionKind === 'clockwork')) {
      toGoal.normalize();
      const lateral = createVector(-toGoal.y, toGoal.x);
      const amount = this.motionKind === 'shark' ? 0.075
        : this.motionKind === 'mantis' ? (chasing ? 0.34 : 0.16) : 0.055;
      lateral.mult(Math.sin(now * (this.motionKind === 'mantis' ? 0.012 : 0.0045) + this.motionPhase) * this.maxForce * amount * 12);
      forces.push({ force: lateral, weight: 1 });
    }
    this.applyForce(SteeringBehaviors.combine(this, forces));
  }

  avoidSanctuary(sanctuaries) {
    let strongestForce = null;
    let strongestMagnitude = 0;
    for (const sanctuary of sanctuaries) {
      const force = sanctuary.steeringAwayFrom(this);
      if (!force) continue;
      const magnitude = force.magSq();
      if (magnitude > strongestMagnitude) {
        strongestForce = force;
        strongestMagnitude = magnitude;
      }
    }
    return strongestForce;
  }

  avoidObstacle(target, obstacles) {
    return SteeringBehaviors.avoidObstacle(this, target, obstacles);
  }

  artKind() {
    return CreatureArt.hasGuardian(this.guardianKind)
      ? this.guardianKind
      : SeekVehicle.ART_BY_MOTION[this.motionKind] ?? 'ash-moth';
  }

  // Figurine du veilleur : elle reste droite et se retourne selon sa marche.
  // L'état de l'IA est lisible : cercle pointillé au sol et étiquette « ! » ou « ? ».
  show(now = millis(), g = PaperArt.screen()) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + this.motionPhase);
    const strideRate = this.motionKind === 'cat' ? 0.015 : this.motionKind === 'mantis' ? 0.021 : 0.009;
    const bob = Math.abs(Math.sin(now * strideRate + this.motionPhase)) * 1.8;
    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.noFill();
    if (this.aiState === 'chase') {
      g.stroke(255, 79, 94, 110 + pulse * 100); g.strokeWeight(2.2);
      PaperArt.dashedCircle(g, 0, 0, this.r * 3.6, 16, now * 0.004);
    } else if (this.aiState === 'investigate') {
      g.stroke(255, 200, 87, 110 + pulse * 70); g.strokeWeight(1.8);
      PaperArt.dashedCircle(g, 0, 0, this.r * 3.3, 12, now * 0.0015);
    }
    PaperArt.groundShadow(g, 0, this.r * 1.1, this.r * 2, this.r * 0.55);
    g.push();
    g.translate(0, -bob);
    if (this.vel.x < -0.2) g.scale(-1, 1);
    CreatureArt.drawGuardian(g, this.artKind(), this.r, { now, phase: this.motionPhase, state: this.aiState });
    g.pop();
    if (this.aiState === 'chase') this.drawStateTag(g, '!', '#ff4f5e', pulse);
    else if (this.aiState === 'investigate') this.drawStateTag(g, '?', '#e0a020', pulse);
    g.pop();
  }

  drawStateTag(g, symbol, color, pulse) {
    const y = -this.r * 2.35 - pulse * 2;
    g.noStroke();
    g.fill(24, 14, 30, 70); g.circle(2, y + 2.5, 19);
    g.fill('#fbf3e2'); g.circle(0, y, 19);
    g.fill(color);
    g.textFont(PaperArt.FONT);
    g.textStyle(BOLD);
    g.textAlign(CENTER, CENTER);
    g.textSize(14);
    g.text(symbol, 0, y + 0.5);
  }
}
