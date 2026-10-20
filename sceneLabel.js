// Message flottant : sa dérive est pilotée par Vehicle comme les autres éléments mobiles.
class SceneLabel extends Vehicle {
  constructor(x, y, message, rgb, duration = 900) {
    super(x, y);
    this.message = message;
    this.rgb = rgb;
    this.duration = duration;
    this.startedAt = millis();
    this.maxSpeed = 1.2;
    this.maxForce = 0.025;
    this.vel.set(0, -0.52);
  }

  isAlive(now) {
    return now - this.startedAt < this.duration;
  }

  // Steering : une légère poussée vers le haut ; la locomotion reste update() de Vehicle.
  steer() {
    this.applyForce(createVector(0, -0.012));
  }

  // Texte autocollant : contour encre épais, puis couleur du message.
  show(now, g = PaperArt.screen()) {
    const alpha = constrain(1 - (now - this.startedAt) / this.duration, 0, 1);
    const pop = 1 + Math.max(0, 0.25 - (now - this.startedAt) / 600);
    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.scale(pop);
    g.textFont(PaperArt.FONT);
    g.textAlign(CENTER, CENTER);
    g.textSize(14);
    g.textStyle(BOLD);
    g.stroke(42, 34, 48, alpha * 230);
    g.strokeWeight(4.5);
    g.strokeJoin(ROUND);
    g.fill(this.rgb[0], this.rgb[1], this.rgb[2], alpha * 255);
    g.text(this.message, 0, 0);
    g.pop();
  }
}
