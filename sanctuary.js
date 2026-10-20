// Refuge temporaire : il protège les esprits et détourne les veilleurs par steering.
class Sanctuary extends Vehicle {
  static RADIUS = 112;
  static LIFETIME_MS = 8000;
  static INFLUENCE_MARGIN = 112;
  static BLOOM_MS = 650;

  constructor(x, y, createdAt) {
    super(x, y);
    this.r = Sanctuary.RADIUS;
    this.createdAt = createdAt;
  }

  contains(vehicle) {
    const protectedRadius = this.r + (vehicle.r || 0);
    return p5.Vector.sub(vehicle.pos, this.pos).magSq() <= protectedRadius ** 2;
  }

  isExpired(now) {
    return now - this.createdAt >= Sanctuary.LIFETIME_MS;
  }

  steeringAwayFrom(vehicle) {
    const away = p5.Vector.sub(vehicle.pos, this.pos);
    const distance = away.mag();
    const influenceRadius = this.r + Sanctuary.INFLUENCE_MARGIN;
    if (distance >= influenceRadius) return null;

    if (distance < 0.001) {
      const heading = vehicle.vel.magSq() > 0.001 ? vehicle.vel.heading() : 0;
      away.set(Math.cos(heading + Math.PI), Math.sin(heading + Math.PI));
    }

    away.setMag(vehicle.maxSpeed);
    const steering = p5.Vector.sub(away, vehicle.vel);
    steering.limit(vehicle.maxForce);
    const strength = constrain(1 - distance / influenceRadius, 0.28, 1);
    return steering.mult(strength);
  }

  // Fleur de papier qui se déplie : pétales en deux couronnes, liseré pointillé
  // et minuterie qui indique le temps de protection restant.
  show(now, g = PaperArt.screen()) {
    const age = now - this.createdAt;
    const remaining = constrain(1 - age / Sanctuary.LIFETIME_MS, 0, 1);
    const bloom = 1 - (1 - constrain(age / Sanctuary.BLOOM_MS, 0, 1)) ** 3;
    const fade = remaining < 0.15 ? remaining / 0.15 : 1;
    const r = this.r * bloom;

    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.noStroke();
    g.fill(255, 244, 205, 34 * fade);
    g.circle(0, 0, r * 2);
    g.noFill();
    g.stroke(255, 248, 222, 190 * fade);
    g.strokeWeight(2.4);
    PaperArt.dashedCircle(g, 0, 0, r * 2, 32, now * 0.0004, 0.6);

    g.noStroke();
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 12 : 8;
      const radius = r * (ring === 0 ? 0.82 : 0.5);
      const spin = now * (ring === 0 ? 0.00012 : -0.0002);
      for (let petal = 0; petal < count; petal++) {
        const angle = spin + petal * Math.PI * 2 / count;
        g.push();
        g.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
        g.rotate(angle);
        g.fill(24, 14, 30, 40 * fade); g.ellipse(2, 3, 26 * bloom, 11 * bloom);
        g.fill(ring === 0 ? '#f6c6d8' : '#ffe8a3'); g.ellipse(0, 0, 26 * bloom, 11 * bloom);
        g.fill(255, 255, 255, 150); g.ellipse(-4 * bloom, -1, 10 * bloom, 3 * bloom);
        g.pop();
      }
    }
    g.fill('#8fd17a');
    PaperArt.star(g, 0, 0, 22 * bloom, 12 * bloom, 6, now * 0.0005);
    g.fill('#ffe28a');
    g.circle(0, 0, 14 * bloom);
    g.noFill();
    g.stroke(255, 255, 255, 220);
    g.strokeWeight(3);
    PaperArt.timerArc(g, 0, 0, 36 * bloom, remaining);
    g.pop();
  }
}
