// Bonus temporaire ramassé par la luciole : une figurine immobile qui hérite de Vehicle.
class PowerUp extends Vehicle {
  static LIFETIME_MS = 14000;
  static RADIUS = 18;
  static TYPES = ['speed', 'invisibility', 'shield', 'energy'];
  static COLORS = {
    speed: '#ffb23f',
    invisibility: '#4fd2f2',
    shield: '#a98bff',
    energy: '#ff6b93',
  };

  constructor(x, y, type, createdAt = 0) {
    super(x, y);
    this.r = PowerUp.RADIUS;
    this.type = PowerUp.TYPES.includes(type) ? type : 'speed';
    this.createdAt = createdAt;
    this.phase = random(TWO_PI);
  }

  isExpired(now) { return now - this.createdAt >= PowerUp.LIFETIME_MS; }

  // Jeton de papier : disque coloré, pastille crème, pictogramme et minuterie.
  show(now = millis(), g = PaperArt.screen()) {
    const remaining = 1 - (now - this.createdAt) / PowerUp.LIFETIME_MS;
    if (remaining < 0.2 && Math.sin(now * 0.025) < -0.3) return;
    const bob = Math.sin(now * 0.004 + this.phase) * 3;
    const color = PowerUp.COLORS[this.type];
    const r = this.r;
    g.push();
    g.translate(this.pos.x, this.pos.y);
    PaperArt.groundShadow(g, 0, r * 0.9, r * 1.6, r * 0.45, 0.8);
    g.translate(0, -r * 0.35 + bob);
    g.noStroke();
    g.fill(...PaperArt.rgb(color), 50);
    g.circle(0, 0, r * 3.1);
    PaperArt.standee(g, s => s.circle(0, 0, r * 1.9), s => {
      s.fill(color); s.circle(0, 0, r * 1.9);
      s.fill('#fbf3e2'); s.circle(0, 0, r * 1.38);
      s.fill(PaperArt.shade(color, 0.82));
      PowerUp.drawIcon(s, this.type, r * 0.55);
    }, { border: 2 });
    g.noFill();
    g.stroke(255, 255, 255, 210);
    g.strokeWeight(2);
    PaperArt.timerArc(g, 0, 0, r * 2.55, remaining);
    g.pop();
  }

  static drawIcon(g, type, s) {
    if (type === 'speed') {
      g.beginShape();
      g.vertex(s * 0.25, -s); g.vertex(-s * 0.55, s * 0.15); g.vertex(-s * 0.02, s * 0.15);
      g.vertex(-s * 0.25, s); g.vertex(s * 0.6, -s * 0.2); g.vertex(s * 0.05, -s * 0.2);
      g.endShape(CLOSE);
    } else if (type === 'invisibility') {
      g.arc(0, -s * 0.1, s * 1.4, s * 1.4, Math.PI, Math.PI * 2);
      g.rect(-s * 0.7, -s * 0.12, s * 1.4, s * 0.7);
      for (let i = 0; i < 3; i++) g.triangle(-s * 0.7 + i * s * 0.47, s * 0.55, -s * 0.47 + i * s * 0.47, s * 0.95, -s * 0.23 + i * s * 0.47, s * 0.55);
      g.fill('#fbf3e2'); g.circle(-s * 0.25, -s * 0.15, s * 0.3); g.circle(s * 0.25, -s * 0.15, s * 0.3);
    } else if (type === 'shield') {
      g.beginShape();
      g.vertex(0, -s); g.vertex(s * 0.8, -s * 0.65); g.vertex(s * 0.7, s * 0.2); g.vertex(0, s);
      g.vertex(-s * 0.7, s * 0.2); g.vertex(-s * 0.8, -s * 0.65);
      g.endShape(CLOSE);
    } else {
      g.circle(-s * 0.38, -s * 0.25, s * 0.85); g.circle(s * 0.38, -s * 0.25, s * 0.85);
      g.triangle(-s * 0.8, -s * 0.1, s * 0.8, -s * 0.1, 0, s * 0.85);
    }
  }
}
