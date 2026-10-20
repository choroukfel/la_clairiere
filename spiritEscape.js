// État de fuite d'un esprit : normal → fuite → (sortie | épuisement) → normal.
//
// - Le rayon de déclenchement (detection) et la distance de sécurité (exit) sont distincts.
//   Pendant la fuite, on mesure la distance réelle au veilleur le plus proche, même au-delà
//   du rayon de déclenchement : sortir du cercle ne suffit pas, il faut atteindre la sécurité.
// - L'endurance (0..1) se consomme pendant la fuite (une endurance pleine dure exactement
//   maxDurationMs) et se régénère en état normal, avec le temps écoulé fourni par la scène.
// - Après épuisement, pas de réarmement à l'image suivante : il faut d'abord que le
//   veilleur le plus proche soit à la distance de sécurité.
// Ce n'est pas une entité : c'est la mémoire de l'esprit, lue par think() et par l'affichage.
const SPIRIT_ESCAPE_EPSILON = 1e-9;

class SpiritEscape {
  static MAX_DURATION_MS = 3500;
  static REGEN_PER_SECOND = 0.25;
  static SAFETY_MARGIN = 70;

  constructor({ maxDurationMs = SpiritEscape.MAX_DURATION_MS, regenPerSecond = SpiritEscape.REGEN_PER_SECOND } = {}) {
    this.maxDurationMs = maxDurationMs;
    this.regenPerSecond = regenPerSecond;
    this.reset();
  }

  // Transition de scénario : la fuite repart de zéro, endurance pleine.
  reset() {
    this.state = 'normal';
    this.endurance = 1;
    this.elapsedMs = 0;
    this.startEndurance = 1;
    this.threatDistance = Infinity;
  }

  isFleeing() {
    return this.state === 'flee';
  }

  // threatDistance : distance au veilleur le plus proche (Infinity s'il n'y en a pas).
  // Renvoie la transition éventuelle : 'start', 'safe', 'exhausted', 'rearmed' ou null.
  update(elapsedMs, threatDistance, detectionRadius, exitDistance) {
    this.threatDistance = threatDistance;

    if (this.state === 'normal') {
      this.endurance = Math.min(1, this.endurance + this.regenPerSecond * elapsedMs / 1000);
      if (threatDistance <= detectionRadius && this.endurance > 0) {
        this.state = 'flee';
        this.elapsedMs = 0;
        this.startEndurance = this.endurance;
        return 'start';
      }
      return null;
    }

    if (this.state === 'flee') {
      this.elapsedMs += elapsedMs;
      this.endurance = Math.max(0, this.startEndurance - this.elapsedMs / this.maxDurationMs);
      if (threatDistance >= exitDistance) {
        this.state = 'normal';
        return 'safe';
      }
      if (this.elapsedMs >= this.startEndurance * this.maxDurationMs - SPIRIT_ESCAPE_EPSILON) {
        this.endurance = 0;
        this.state = 'exhausted';
        return 'exhausted';
      }
      return null;
    }

    // épuisé : on attend le retour en sécurité pour réarmer
    if (threatDistance >= exitDistance) {
      this.state = 'normal';
      return 'rearmed';
    }
    return null;
  }
}
