// Outils de rendu « papier découpé » : contours organiques, ombres portées et
// liserés d'autocollant. Chaque fonction dessine sur une cible `g` : le canvas
// principal (mode global de p5) ou un p5.Graphics (miniatures du menu).
// Aucun calcul de steering ici : ce module ne fait que dessiner.
const PaperArt = {
  // Lumière venant du haut-gauche : les ombres tombent vers le bas-droite.
  SHADOW_OFFSET: { x: 2.6, y: 3.6 },
  SHADOW: [24, 14, 30, 78],
  OUTLINE: '#fbf6ea',
  INK: '#2a2230',
  FONT: 'Fredoka, Nunito, "Trebuchet MS", system-ui, sans-serif',

  // Cible de dessin par défaut : les fonctions globales de p5.
  screen() {
    return globalThis;
  },

  clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  },

  // Générateur pseudo-aléatoire déterministe (mulberry32).
  rng(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  },

  rgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  hex([r, g, b]) {
    const part = v => Math.round(PaperArt.clamp(v, 0, 255)).toString(16).padStart(2, '0');
    return `#${part(r)}${part(g)}${part(b)}`;
  },

  mix(a, b, amount) {
    const ca = PaperArt.rgb(a);
    const cb = PaperArt.rgb(b);
    return PaperArt.hex(ca.map((v, i) => v + (cb[i] - v) * amount));
  },

  shade(hex, factor) {
    return PaperArt.hex(PaperArt.rgb(hex).map(v => v * factor));
  },

  // Contour fermé irrégulier : un rayon modulé par trois harmoniques.
  blob(rand, radius, irregularity = 0.18, points = 28) {
    const harmonics = [2, 3, 5].map(order => ({
      order,
      amplitude: (0.35 + rand() * 0.65) * irregularity / order * 2,
      phase: rand() * Math.PI * 2,
    }));
    const result = [];
    for (let i = 0; i < points; i++) {
      const angle = Math.PI * 2 * i / points;
      let factor = 1;
      for (const h of harmonics) factor += h.amplitude * Math.sin(h.order * angle + h.phase);
      factor = Math.max(0.45, factor);
      result.push({ x: Math.cos(angle) * radius * factor, y: Math.sin(angle) * radius * factor });
    }
    return result;
  },

  polygon(g, points, ox = 0, oy = 0, scale = 1) {
    g.beginShape();
    for (const point of points) g.vertex(ox + point.x * scale, oy + point.y * scale);
    g.endShape(CLOSE);
  },

  // Segment arrondi plein (branche, tige, patte) : se contourne comme une forme pleine.
  capsule(g, x1, y1, x2, y2, thickness) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    g.push();
    g.translate(x1, y1);
    g.rotate(Math.atan2(y2 - y1, x2 - x1));
    g.rect(-thickness / 2, -thickness / 2, length + thickness, thickness, thickness / 2);
    g.pop();
  },

  // Étoile pleine (cristaux, étincelles, épines).
  star(g, x, y, outer, inner, spikes, rotation = -Math.PI / 2) {
    g.beginShape();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = rotation + Math.PI * i / spikes;
      g.vertex(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    g.endShape(CLOSE);
  },

  // Ombre douce posée au sol sous une figurine.
  groundShadow(g, x, y, w, h, alpha = 1) {
    g.noStroke();
    g.fill(24, 14, 30, 34 * alpha);
    g.ellipse(x, y, w * 1.18, h * 1.25);
    g.fill(24, 14, 30, 52 * alpha);
    g.ellipse(x, y, w, h);
  },

  // Figurine de papier : ombre décalée, liseré clair, puis le dessin coloré.
  // `silhouette(g)` trace la forme pleine avec le remplissage/contour courant.
  standee(g, silhouette, paint, { outline = PaperArt.OUTLINE, border = 2.4, shadow = true } = {}) {
    if (shadow) {
      g.push();
      g.translate(PaperArt.SHADOW_OFFSET.x, PaperArt.SHADOW_OFFSET.y);
      g.fill(...PaperArt.SHADOW);
      g.stroke(...PaperArt.SHADOW);
      g.strokeWeight(border * 2);
      silhouette(g);
      g.pop();
    }
    g.push();
    g.fill(outline);
    g.stroke(outline);
    g.strokeWeight(border * 2);
    silhouette(g);
    g.pop();
    g.push();
    g.noStroke();
    paint(g);
    g.pop();
  },

  // Cercle pointillé (zones, rayons de sécurité, anneaux d'effet).
  // Sur un vrai canvas : un seul tracé avec setLineDash ; sinon, une série d'arcs.
  dashedCircle(g, x, y, diameter, dashes = 24, phase = 0, fill = 0.55) {
    const ctx = g.drawingContext;
    if (ctx && typeof ctx.setLineDash === 'function') {
      const dash = Math.PI * diameter / dashes;
      ctx.setLineDash([dash * fill, dash * (1 - fill)]);
      ctx.lineDashOffset = -phase * diameter / 2;
      g.circle(x, y, diameter);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      return;
    }
    const step = Math.PI * 2 / dashes;
    for (let i = 0; i < dashes; i++) {
      const start = phase + i * step;
      g.arc(x, y, diameter, diameter, start, start + step * fill);
    }
  },

  // Arc de minuterie : `fraction` restante entre 0 et 1, départ en haut.
  timerArc(g, x, y, diameter, fraction) {
    const f = PaperArt.clamp(fraction, 0, 1);
    if (f <= 0) return;
    g.arc(x, y, diameter, diameter, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
  },
};
