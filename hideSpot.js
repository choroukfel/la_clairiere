// Cachette sûre : tant que la luciole y reste, les veilleurs ne la voient pas.
// Figurine immobile qui hérite de Vehicle (géométrie pos / r).
class HideSpot extends Vehicle {
  static RADIUS = 39;
  constructor(x, y, kind = 'fern-bush') {
    super(x, y);
    this.r = HideSpot.RADIUS;
    this.kind = kind;
  }

  contains(vehicle) {
    return p5.Vector.dist(this.pos, vehicle.pos) <= this.r + (vehicle.r || 0) * 0.55;
  }

  // Cachette : cercle pointillé au sol, figurine du lieu et étiquette de papier.
  show(now = millis(), g = PaperArt.screen()) {
    const x = this.pos.x;
    const y = this.pos.y;
    const r = this.r;
    const pulse = 0.5 + Math.sin(now * 0.003) * 0.5;
    g.push();
    g.noStroke();
    g.fill(190, 255, 214, 22 + pulse * 18);
    g.circle(x, y, r * 2.7);
    g.noFill();
    g.stroke(214, 255, 226, 120 + pulse * 90);
    g.strokeWeight(2);
    PaperArt.dashedCircle(g, x, y, r * 2.7 + pulse * 4, 20, now * 0.0003);
    PropArt.draw(g, this.kind, x, y + r * 0.2, r * 0.82, now);
    g.translate(x, y + r + 12);
    g.rotate(-0.04);
    g.noStroke();
    g.fill(24, 14, 30, 70); g.rect(-31, -7, 64, 17, 4);
    g.fill('#fbf3e2'); g.rect(-33, -9, 64, 17, 4);
    g.fill('#2a2230');
    g.textFont(PaperArt.FONT);
    g.textStyle(BOLD);
    g.textAlign(CENTER, CENTER);
    g.textSize(10);
    g.text('CACHETTE', -1, -1);
    g.pop();
  }
}
