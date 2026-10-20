// Missile génétique (exemple 10 « missiles génétiques ») : chaque gène est une force appliquée
// par applyForce, la locomotion reste celle de Vehicle. Classe de base des feux follets
// migrateurs (migratingWisp.js).
class GeneticRocket extends Vehicle {
  constructor(x, y, dna = null) {
    super(x, y);
    this.r = 5;
    this.maxSpeed = 4.4;
    this.maxForce = 0.18;
    this.dna = dna || new TrajectoryDNA();
    this.geneIndex = 0;
    this.age = 0;
    this.hitTarget = false;
    this.hitObstacle = false;
    this.caught = false;
    this.finished = false;
    this.bestDistance = Infinity;
    this.fitness = 0;
  }

  // hazards : dangers mobiles { pos, r } (veilleurs) ; les toucher termine le vol
  step(target, obstacles, lifetime, hazards = []) {
    if (this.finished) return;
    if (this.geneIndex < this.dna.genes.length) this.applyForce(this.dna.genes[this.geneIndex]);
    this.geneIndex++;
    this.update();
    this.age++;
    this.edgesLab();
    const distance = p5.Vector.dist(this.pos, target.pos);
    this.bestDistance = Math.min(this.bestDistance, distance);
    if (distance < target.r + this.r) { this.hitTarget = true; this.finished = true; }
    if (obstacles.some(obstacle => p5.Vector.dist(this.pos, obstacle.pos) < obstacle.r + this.r)) {
      this.hitObstacle = true;
      this.finished = true;
    }
    if (!this.hitTarget && hazards.some(hazard => p5.Vector.dist(this.pos, hazard.pos) < hazard.r + this.r)) {
      this.caught = true;
      this.hitObstacle = true;
      this.finished = true;
    }
    if (this.age >= lifetime || this.geneIndex >= this.dna.genes.length) this.finished = true;
  }

  // Règle de scène : toucher le bord de la scène termine le vol (sans recadrer la position).
  edgesLab() {
    if (this.pos.x < 4 || this.pos.x > width - 4 || this.pos.y < 4 || this.pos.y > height - 4) {
      this.finished = true;
      this.hitObstacle = true;
    }
  }

  calcFitness() {
    const distance = Number.isFinite(this.bestDistance) ? this.bestDistance : 1000;
    this.fitness = 1 / ((distance + 8) ** 2);
    if (this.hitObstacle) this.fitness *= 0.08;
    if (this.hitTarget) this.fitness *= 25;
    this.fitness *= 1 + Math.min(this.age, 210) / 210 * 0.12;
    return this.fitness;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.magSq() > 0.001 ? this.vel.heading() + HALF_PI : 0);
    noStroke();
    fill(this.hitTarget ? '#bff7b1' : this.hitObstacle ? '#ff8b9d' : '#8be7ff');
    triangle(0, -this.r * 2, -this.r, this.r * 1.5, this.r, this.r * 1.5);
    pop();
  }
}
