// Nid des feux follets : la destination de leur migration. Figurine immobile (un Vehicle,
// géométrie pos / r) ; un feu follet qui y entre a réussi son vol.
class WispNest extends Vehicle {
  static RADIUS = 34;

  constructor(x, y) {
    super(x, y);
    this.r = WispNest.RADIUS;
  }

  show(now = millis(), g = PaperArt.screen()) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    g.push();
    g.noStroke();
    g.fill(170, 255, 230, 26 + pulse * 22);
    g.circle(this.pos.x, this.pos.y, this.r * 3);
    g.fill(42, 34, 48, 60);
    g.circle(this.pos.x + 2, this.pos.y + 3, this.r * 1.5);
    g.fill('#fbf3e2');
    g.circle(this.pos.x, this.pos.y, this.r * 1.5);
    g.fill(150, 235, 210, 200);
    g.circle(this.pos.x, this.pos.y, this.r * 0.8);
    g.noFill();
    g.stroke(214, 255, 236, 140 + pulse * 90);
    g.strokeWeight(2);
    PaperArt.dashedCircle(g, this.pos.x, this.pos.y, this.r * 2.2 + pulse * 6, 18, now * 0.0005);
    g.pop();
  }
}
