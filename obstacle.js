// Obstacle fixe du diorama : une figurine de papier qui hérite de Vehicle.
// La collision et l'évitement utilisent uniquement pos et r.
class Obstacle extends Vehicle {
  constructor(x, y, radius, kind = 'mossy-rock') {
    super(x, y);
    this.r = radius;
    this.kind = kind;
  }

  show(now = millis(), g = PaperArt.screen()) {
    PropArt.draw(g, this.kind, this.pos.x, this.pos.y, this.r, now);
  }
}
