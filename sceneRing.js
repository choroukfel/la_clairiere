// Anneau d'effet ancré dans la scène; son animation est rendue par une entité Vehicle.
class SceneRing extends Vehicle {
  constructor(x, y, rgb, duration = 560, radius = 68) {
    super(x, y);
    this.rgb = rgb;
    this.duration = duration;
    this.radius = radius;
    this.startedAt = millis();
  }

  isAlive(now) {
    return now - this.startedAt < this.duration;
  }

  // Double anneau de papier : un trait plein et un pointillé qui tourne.
  show(now, g = PaperArt.screen()) {
    const progress = constrain((now - this.startedAt) / this.duration, 0, 1);
    const alpha = 1 - progress;
    const eased = 1 - (1 - progress) ** 3;
    const diameter = 10 + this.radius * eased;
    g.push();
    g.noFill();
    g.stroke(this.rgb[0], this.rgb[1], this.rgb[2], alpha * 230);
    g.strokeWeight(2 + alpha * 2);
    g.circle(this.pos.x, this.pos.y, diameter);
    g.stroke(255, 255, 255, alpha * 180);
    g.strokeWeight(1.6);
    PaperArt.dashedCircle(g, this.pos.x, this.pos.y, diameter * 1.18, 14, progress * 2);
    g.pop();
  }
}
