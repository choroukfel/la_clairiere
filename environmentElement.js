// Éléments d'ambiance : ils dérivent par steering, jamais par téléportation continue.
const FALLING_ELEMENTS = ['snowflake'];
const RISING_ELEMENTS = ['ember-spark', 'bubble'];
const DRIFTING_ELEMENTS = ['sand-grain', 'cloud-wisp'];

// Décor mobile : positions/vitesses/accélérations restent celles d'un Vehicle.
class EnvironmentElement extends Vehicle {
  constructor(x, y, { kind, speed = 0.25, region = 'any' }) {
    super(x, y);
    this.kind = kind;
    this.region = region;
    this.r = 4;
    this.maxSpeed = speed;
    this.maxForce = Math.max(0.01, speed * 0.035);
    this.phase = random(TWO_PI);
    this.wanderHeading = random(TWO_PI);
    this.vel = p5.Vector.fromAngle(this.wanderHeading).mult(speed * 0.55);
  }

  // Steering : vitesse désirée selon le type d'élément, puis désirée − actuelle.
  // La locomotion reste update() hérité de Vehicle, appelé par EnvironmentScene.
  steer() {
    let desired;
    const t = this.phase + millis() * 0.001;
    if (FALLING_ELEMENTS.includes(this.kind)) {
      desired = createVector(Math.sin(t * 1.3) * this.maxSpeed * 0.7, this.maxSpeed);
    } else if (RISING_ELEMENTS.includes(this.kind)) {
      desired = createVector(Math.sin(t * 1.7) * this.maxSpeed * 0.5, -this.maxSpeed);
    } else if (DRIFTING_ELEMENTS.includes(this.kind)) {
      desired = createVector(this.maxSpeed, Math.sin(t) * this.maxSpeed * 0.25);
    } else {
      desired = SteeringBehaviors.wander(this, 0.012);
      desired = p5.Vector.add(this.vel, desired);
      if (desired.magSq() > 0.001) desired.setMag(this.maxSpeed);
    }

    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    this.applyForce(steering);
  }

  // Règle de scène explicite (comme edges() de Vehicle) : un élément sorti du décor
  // réapparaît du côté opposé ; neige, braises et bulles reviennent à une abscisse aléatoire.
  wrapInScene(widthLimit, heightLimit) {
    if (FALLING_ELEMENTS.includes(this.kind)) {
      if (this.pos.y > heightLimit + 8) { this.pos.y = -8; this.pos.x = random(widthLimit); }
    } else if (RISING_ELEMENTS.includes(this.kind)) {
      if (this.pos.y < -8) { this.pos.y = heightLimit + 8; this.pos.x = random(widthLimit); }
    } else if (DRIFTING_ELEMENTS.includes(this.kind)) {
      if (this.pos.x > widthLimit + 40) { this.pos.x = -40; this.pos.y = random(heightLimit); }
    } else {
      if (this.pos.x < -18) this.pos.x = widthLimit + 18;
      if (this.pos.x > widthLimit + 18) this.pos.x = -18;
      if (this.pos.y < heightLimit * 0.13) this.pos.y = heightLimit * 0.86;
      if (this.pos.y > heightLimit * 0.88) this.pos.y = heightLimit * 0.14;
    }
  }

  show(now, g = PaperArt.screen()) {
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.006 + this.phase * 3);
    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.noStroke();
    if (this.kind === 'glow-mote') {
      g.fill(244, 222, 110, 26 + flicker * 34); g.circle(0, 0, 16);
      g.fill(255, 246, 190, 140 + flicker * 110); g.circle(0, 0, 3.6);
    } else if (this.kind === 'snowflake') {
      g.rotate(this.phase + now * 0.0008);
      g.fill(60, 80, 120, 50); PaperArt.star(g, 1, 1.4, 4.2, 1.6, 6);
      g.fill(255, 255, 255, 235); PaperArt.star(g, 0, 0, 4.2, 1.6, 6);
    } else if (this.kind === 'sand-grain') {
      g.stroke(255, 236, 196, 70); g.strokeWeight(1); g.line(-10, 0, -2, 0); g.noStroke();
      g.rotate(this.phase + now * 0.004);
      g.fill(120, 70, 30, 60); g.rect(-0.5, -0.2, 3.4, 2.4);
      g.fill(250, 224, 170, 230); g.rect(-1.5, -1.2, 3.4, 2.4);
    } else if (this.kind === 'ember-spark') {
      g.fill(255, 110, 40, 30 + flicker * 50); g.circle(0, 0, 12);
      g.fill(255, 170, 70, 230); g.circle(0, 0, 4.2);
      g.fill(255, 240, 180, 240); g.circle(-0.6, -0.6, 1.8);
    } else if (this.kind === 'cloud-wisp') {
      g.fill(30, 40, 100, 16); g.ellipse(6, 10, 66, 26);
      g.fill(255, 255, 255, 70); g.ellipse(-12, 0, 30, 18); g.ellipse(6, -4, 38, 24); g.ellipse(20, 2, 26, 16);
    } else if (this.kind === 'bubble') {
      g.noFill(); g.stroke(200, 240, 255, 150); g.strokeWeight(1.3); g.circle(0, 0, 7 + flicker * 1.5);
      g.noStroke(); g.fill(255, 255, 255, 200); g.circle(-1.4, -1.4, 2);
    }
    g.pop();
  }
}
