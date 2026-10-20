// Appel de la luciole : un son émis à une position, perçu dans un rayon d'audition qui
// grandit avec le volume (un cri porte plus loin qu'un clap). Ce n'est pas une entité :
// c'est un stimulus que les esprits et les veilleurs perçoivent dans leur think().
//  - un esprit sauvage qui l'entend (et ne fuit pas) vient vers la luciole (arrive) ;
//  - un veilleur qui l'entend, sans cible en vue, vient enquêter à l'endroit du bruit.
class SoundCall {
  static DURATION_MS = 2500;
  static BASE_RADIUS = 220;
  static RADIUS_PER_LOUDNESS = 600;
  static MAX_RADIUS = 760;
  static COOLDOWN_MS = 4000;

  constructor(x, y, loudness, at) {
    this.pos = createVector(x, y);
    this.loudness = constrain(loudness, 0, 1);
    this.radius = Math.min(SoundCall.MAX_RADIUS, SoundCall.BASE_RADIUS + this.loudness * SoundCall.RADIUS_PER_LOUDNESS);
    this.at = at;
  }

  isActive(now) {
    return now - this.at < SoundCall.DURATION_MS;
  }

  // seuil inclusif : à exactement `radius`, le son est entendu
  hears(entity) {
    return p5.Vector.dist(entity.pos, this.pos) <= this.radius;
  }
}
