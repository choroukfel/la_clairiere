// Esprit sauvé : il rejoint le cortège de la luciole pendant quelques secondes, puis s'envole.
// Comportements de Reynolds, combinés par somme pondérée :
//  - leader following : viser un point situé DERRIÈRE son meneur (arrive avec décalage,
//    comme les anneaux du serpent de l'exemple 3-Arrival_correction) ; la file se forme
//    car chaque esprit suit le précédent, le premier suit la luciole ;
//  - s'écarter de la zone située DEVANT le meneur (ne pas lui barrer la route) ;
//  - séparation entre les esprits du cortège.
// La locomotion reste celle de Vehicle (update), appelée une fois par image par la scène.
class FollowerSpirit extends Vehicle {
  static LIFETIME_MS = 6000;
  static FADE_MS = 900;
  static SPACING = 26;
  static LOOKAHEAD_FRAMES = 8;
  static AHEAD_DISTANCE = 42;
  static AHEAD_RADIUS = 30;
  static MAX_COUNT = 8;

  constructor(x, y, spiritKind, leader, bornAt) {
    super(x, y);
    this.r = 10;
    this.maxSpeed = 5.2;
    this.maxForce = 0.32;
    this.spiritKind = spiritKind;
    this.leader = leader;
    this.bornAt = bornAt;
    this.phase = random(TWO_PI);
    this.lastForces = {};
  }

  isAlive(now) {
    return now - this.bornAt < FollowerSpirit.LIFETIME_MS;
  }

  // Point de rendez-vous (offset pursuit) : derrière la position FUTURE du meneur, dans le
  // sens opposé à sa vitesse. Viser sa position future compense le retard d'arrive.
  followPoint() {
    const leader = this.leader;
    if (leader.vel.magSq() < 0.01) return leader.pos.copy();
    const future = p5.Vector.add(leader.pos, leader.vel.copy().mult(FollowerSpirit.LOOKAHEAD_FRAMES));
    return p5.Vector.add(future, leader.vel.copy().setMag(-FollowerSpirit.SPACING));
  }

  // zone devant le meneur, à laisser libre
  aheadPoint() {
    const leader = this.leader;
    if (leader.vel.magSq() < 0.01) return null;
    return p5.Vector.add(leader.pos, leader.vel.copy().setMag(FollowerSpirit.AHEAD_DISTANCE));
  }

  steer(followers = []) {
    const ahead = this.aheadPoint();
    const inFront = ahead && p5.Vector.dist(this.pos, ahead) < FollowerSpirit.AHEAD_RADIUS;
    this.lastForces = {
      follow: SteeringBehaviors.arrive(this, this.followPoint(), 60),
      separate: SteeringBehaviors.separate(this, followers, FollowerSpirit.SPACING * 0.9),
      clear: inFront ? SteeringBehaviors.flee(this, ahead) : null,
    };
    this.applyForce(SteeringBehaviors.combine(this, [
      { force: this.lastForces.follow, weight: 1 },
      { force: this.lastForces.separate, weight: 1.5 },
      { force: this.lastForces.clear, weight: 2 },
    ]));
  }

  show(now = millis(), g = PaperArt.screen()) {
    const age = now - this.bornAt;
    const remaining = FollowerSpirit.LIFETIME_MS - age;
    const alpha = constrain(remaining / FollowerSpirit.FADE_MS, 0, 1);
    const art = SPIRIT_ART[this.spiritKind] ?? SPIRIT_ART.firefly;
    g.push();
    if (g.drawingContext) g.drawingContext.globalAlpha = alpha;
    // à la fin, l'esprit s'élève en s'envolant
    g.translate(this.pos.x, this.pos.y - (1 - alpha) * 18 + Math.sin(now * 0.012 + this.phase) * 2);
    if (this.vel.x < -0.2) g.scale(-1, 1);
    CreatureArt.drawSpirit(g, this.spiritKind, this.r, { now, phase: this.phase, glow: art.glow });
    g.pop();
  }
}
