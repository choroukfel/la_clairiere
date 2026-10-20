// Feu follet migrateur (exemple 10 intégré au jeu) : un missile génétique de la Clairière.
// Il suit son ADN de trajectoire — une force par image, appliquée par applyForce — et la
// locomotion reste celle de Vehicle (héritée via GeneticRocket). Il doit atteindre le nid
// sans toucher d'obstacle, de veilleur ni le bord. La sélection, le croisement et la
// mutation des meilleurs ADN se font dans GeneticPopulation.
class MigratingWisp extends GeneticRocket {
  static GENES = 600;
  static MAX_FORCE = 0.16;

  constructor(x, y, dna = null) {
    super(x, y, dna ?? new TrajectoryDNA(null, MigratingWisp.GENES, MigratingWisp.MAX_FORCE));
    this.r = 6;
    this.maxSpeed = 3.2;
    this.maxForce = MigratingWisp.MAX_FORCE;
    this.phase = random(TWO_PI);
    this.rewarded = false;
  }

  // petite flamme lumineuse ; elle pâlit quand le vol est terminé sans arriver
  show(now = millis(), g = PaperArt.screen()) {
    const flicker = 0.6 + 0.4 * Math.sin(now * 0.02 + this.phase);
    const dim = this.finished && !this.hitTarget ? 0.3 : 1;
    const tail = this.vel.magSq() > 0.01 ? this.vel.copy().setMag(-9) : createVector(0, 0);
    g.push();
    g.noStroke();
    g.fill(170, 255, 230, 40 * flicker * dim);
    g.circle(this.pos.x, this.pos.y, this.r * 5);
    g.fill(150, 245, 220, 120 * dim);
    g.circle(this.pos.x + tail.x, this.pos.y + tail.y, this.r * 1.2);
    g.fill(235, 255, 248, 230 * dim);
    g.circle(this.pos.x, this.pos.y, this.r * 1.6);
    g.pop();
  }
}
