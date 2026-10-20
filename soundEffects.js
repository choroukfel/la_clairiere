// Effets sonores synthétisés avec le Web Audio (aucun fichier) : sauvetage, capture,
// esprit perdu, duplication, refuge, bonus, niveau et appel. Respectent la case
// « Ambiance sonore » et le volume des réglages. Chaque son est une courte suite de notes
// (fréquence en Hz, début et durée en secondes) jouées par un oscillateur à enveloppe.
const SoundEffects = {
  SOUNDS: {
    rescue: { type: 'triangle', notes: [[880, 0, 0.12], [1320, 0.08, 0.18]], gain: 0.22 },
    capture: { type: 'sawtooth', notes: [[180, 0, 0.18], [110, 0.12, 0.3]], gain: 0.18 },
    lost: { type: 'sine', notes: [[520, 0, 0.16], [390, 0.12, 0.16], [260, 0.24, 0.26]], gain: 0.16 },
    duplicate: { type: 'sine', notes: [[660, 0, 0.08], [990, 0.07, 0.1]], gain: 0.14 },
    sanctuary: { type: 'sine', notes: [[392, 0, 0.6], [523, 0.1, 0.6], [659, 0.2, 0.7]], gain: 0.12 },
    powerup: { type: 'square', notes: [[740, 0, 0.07], [988, 0.06, 0.09]], gain: 0.08 },
    level: { type: 'triangle', notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.3]], gain: 0.18 },
    call: { type: 'sine', notes: [[600, 0, 0.25], [900, 0.05, 0.35]], gain: 0.14 },
  },

  // contexte audio de p5.sound, si le son est autorisé ; sinon null (aucun son joué)
  context() {
    if (typeof soundEnabled === 'undefined' || !soundEnabled) return null;
    if (typeof getAudioContext !== 'function') return null;
    const context = getAudioContext();
    return context && context.state === 'running' ? context : null;
  },

  // Joue un son ; renvoie true s'il a été joué.
  play(name) {
    const sound = this.SOUNDS[name];
    const context = this.context();
    if (!sound || !context) return false;
    const volume = typeof soundVolume === 'number' ? soundVolume : 0.25;
    const start = context.currentTime;
    for (const [frequency, offset, duration] of sound.notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = sound.type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(sound.gain * volume * 2, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.05);
    }
    return true;
  },
};
