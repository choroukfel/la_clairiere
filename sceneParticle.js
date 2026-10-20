// Confettis de papier : leur trajectoire utilise la locomotion de Vehicle.
class SceneParticle extends Vehicle {
  constructor(x, y, { vx, vy, radius, rgb, duration, gravity = 0.015, friction = 0.97 }) {
    super(x, y);
    this.type = 'confetti';
    this.radius = radius;
    this.rgb = rgb;
    this.duration = duration;
    this.gravity = gravity;
    this.friction = friction;
    this.startedAt = millis();
    this.maxSpeed = 9;
    // assez de force pour la gravité et pour la traînée à pleine vitesse
    this.maxForce = Math.max(0.02, Math.abs(gravity), this.maxSpeed * (1 - friction));
    this.vel.set(vx, vy);
    this.angle = random(TWO_PI);
    this.spin = random(-0.012, 0.012);
    this.shape = Math.floor(random(3));
  }

  isAlive(now) {
    return now - this.startedAt < this.duration;
  }

  // Steering : gravité, plus une traînée de Reynolds — vitesse désirée = vitesse × frottement,
  // donc steering = désirée − actuelle — au lieu de multiplier directement la vitesse.
  // La locomotion reste update() hérité de Vehicle, appelé par la scène.
  steer() {
    this.applyForce(createVector(0, this.gravity));
    const drag = p5.Vector.sub(p5.Vector.mult(this.vel, this.friction), this.vel);
    drag.limit(this.maxForce);
    this.applyForce(drag);
  }

  show(now, g = PaperArt.screen()) {
    const alpha = constrain(1 - (now - this.startedAt) / this.duration, 0, 1);
    const size = this.radius * (1.1 + alpha * 0.9);
    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.rotate(this.angle + (now - this.startedAt) * this.spin);
    g.noStroke();
    g.fill(this.rgb[0], this.rgb[1], this.rgb[2], alpha * 240);
    if (this.shape === 0) g.rect(-size, -size * 0.55, size * 2, size * 1.1);
    else if (this.shape === 1) g.triangle(-size, size * 0.8, size, size * 0.8, 0, -size);
    else g.circle(0, 0, size * 1.5);
    g.pop();
  }
}
