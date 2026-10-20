// Capteur à rayon (exemples 9 / 9b du cours) : une donnée de perception, pas une entité du
// monde. Il ne se déplace pas : à chaque mesure, il part de la position de son porteur, dans
// une direction relative à son cap (sa vitesse), et avance par pas jusqu'au premier danger :
// un disque { pos, r } (obstacle, veilleur) ou, si `bounded`, le bord de la scène.
// Les esprits neuronaux en portent trois (devant, 45° à gauche, 45° à droite) : leurs mesures
// entrent dans le réseau de neurones.
class SensorRay {
  static STEP = 6;

  constructor(angleOffset = 0, length = 110) {
    this.angleOffset = angleOffset;
    this.length = length;
    this.origin = createVector(0, 0);
    this.direction = createVector(1, 0);
    this.hitDistance = length;
    this.hit = false;
  }

  // Renvoie la distance libre normalisée (1 = rien devant, 0 = danger au contact).
  sense(vehicle, dangers = [], { bounded = true } = {}) {
    const heading = Number.isFinite(vehicle.heading)
      ? vehicle.heading
      : (vehicle.vel.magSq() > 1e-6 ? vehicle.vel.heading() : 0);
    this.origin = vehicle.pos.copy();
    this.direction = p5.Vector.fromAngle(heading + this.angleOffset);
    this.hitDistance = this.length;
    this.hit = false;
    for (let distance = SensorRay.STEP; distance <= this.length; distance += SensorRay.STEP) {
      const point = p5.Vector.add(this.origin, this.direction.copy().mult(distance));
      const outside = bounded && (point.x < 0 || point.x > width || point.y < 0 || point.y > height);
      if (outside || dangers.some(danger => p5.Vector.dist(point, danger.pos) < danger.r)) {
        this.hitDistance = distance;
        this.hit = true;
        break;
      }
    }
    return this.hitDistance / this.length;
  }

  // proximité du danger (1 = au contact, 0 = rien sur toute la longueur du rayon)
  proximity() {
    return 1 - this.hitDistance / this.length;
  }

  // Debug : lecture de la dernière mesure, sans la recalculer.
  show() {
    const ray = this.direction.copy().mult(this.hitDistance);
    stroke(this.hit ? '#ffb4a2' : '#8ddfc1');
    strokeWeight(1);
    line(this.origin.x, this.origin.y, this.origin.x + ray.x, this.origin.y + ray.y);
  }
}
