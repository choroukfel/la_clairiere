// Personnages en papier découpé : esprits à sauver, veilleurs et avatars du joueur.
// Chaque personnage est dessiné à l'origine, tourné vers la droite ; l'appelant
// gère la position, le flottement et le retournement selon la vitesse.
const CreatureArt = {
  STATE_EYES: { chase: '#ff4f5e', investigate: '#ffc857' },

  hasSpirit(kind) { return Boolean(CreatureArt.SPIRITS[kind]); },
  hasGuardian(kind) { return Boolean(CreatureArt.GUARDIANS[kind]); },
  hasAvatar(id) { return Boolean(CreatureArt.AVATARS[id]); },

  FRAMES: 8,
  MAX_SPRITES: 400,
  sprites: {},

  drawSpirit(g, kind, r, { now = 0, phase = 0, glow = [255, 230, 150] } = {}) {
    const key = CreatureArt.SPIRITS[kind] ? kind : 'firefly';
    const spec = CreatureArt.SPIRITS[key];
    const pulse = 1 + Math.sin(now * 0.006 + phase) * 0.08;
    g.noStroke();
    g.fill(...glow, 34); g.circle(0, 0, r * 3.6 * pulse);
    g.fill(...glow, 50); g.circle(0, 0, r * 2.5 * pulse);
    const render = (target, t, p) => PaperArt.standee(target, s => spec.silhouette(s, r, t, p), s => spec.paint(s, r, t, p), { border: 2 });
    if (!CreatureArt.blit(g, `spirit:${key}`, spec, r, now, phase, render)) render(g, now, phase);
  },

  drawGuardian(g, kind, r, { now = 0, phase = 0, state = 'patrol' } = {}) {
    const key = CreatureArt.GUARDIANS[kind] ? kind : 'bramble';
    const spec = CreatureArt.GUARDIANS[key];
    const eye = CreatureArt.STATE_EYES[state] ?? spec.eye;
    const render = (target, t, p) => PaperArt.standee(target, s => spec.silhouette(s, r, t, p), s => spec.paint(s, r, t, p, eye), { outline: '#f3e7d3', border: 2.2 });
    if (!CreatureArt.blit(g, `guardian:${key}:${eye}`, spec, r, now, phase, render)) render(g, now, phase);
  },

  // Animation image par image (« stop-motion ») : chaque pose du cycle `spec.cycle`
  // (radians par milliseconde) est peinte une seule fois dans un sprite, puis copiée.
  frameIndex(spec, now, phase) {
    if (!spec.cycle) return 0;
    const turns = (now * spec.cycle + phase) / (Math.PI * 2);
    return Math.floor((((turns % 1) + 1) % 1) * CreatureArt.FRAMES) % CreatureArt.FRAMES;
  },

  blit(g, family, spec, r, now, phase, render) {
    if (typeof createGraphics !== 'function') return false;
    const frame = CreatureArt.frameIndex(spec, now, phase);
    const key = `${family}:${Math.round(r * 2) / 2}:${frame}`;
    let sprite = CreatureArt.sprites[key];
    if (!sprite) {
      if (Object.keys(CreatureArt.sprites).length >= CreatureArt.MAX_SPRITES) CreatureArt.clearSprites();
      const size = Math.ceil(r * 4.6);
      const buffer = createGraphics(size, size);
      buffer.translate(size / 2, size / 2);
      const frameTime = spec.cycle ? (frame + 0.5) / CreatureArt.FRAMES * Math.PI * 2 / spec.cycle : 0;
      render(buffer, frameTime, 0);
      sprite = { buffer, size };
      CreatureArt.sprites[key] = sprite;
    }
    g.image(sprite.buffer, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size);
    return true;
  },

  clearSprites() {
    for (const sprite of Object.values(CreatureArt.sprites)) sprite.buffer.remove?.();
    CreatureArt.sprites = {};
  },

  drawAvatar(g, id, r, { now = 0 } = {}) {
    const spec = CreatureArt.AVATARS[id] ?? CreatureArt.AVATARS.firefly;
    const pulse = 1 + Math.sin(now * 0.005) * 0.06;
    g.noStroke();
    g.fill(...spec.glow, 40); g.circle(0, 0, r * 4.6 * pulse);
    g.fill(...spec.glow, 70); g.circle(0, 0, r * 3.1 * pulse);
    PaperArt.standee(g, s => spec.silhouette(s, r, now), s => spec.paint(s, r, now), { outline: '#fff4c2', border: 2.8 });
  },

  eye(g, x, y, size, pupil = '#2a2230', white = '#ffffff') {
    g.fill(white); g.circle(x, y, size);
    g.fill(pupil); g.circle(x + size * 0.12, y + size * 0.05, size * 0.55);
    g.fill(255, 255, 255, 230); g.circle(x - size * 0.05, y - size * 0.15, size * 0.2);
  },

  glowEye(g, x, y, w, h, color) {
    g.fill(...PaperArt.rgb(color), 80); g.ellipse(x, y, w * 2.2, h * 2.2);
    g.fill(color); g.ellipse(x, y, w, h);
    g.fill(255, 255, 255, 220); g.circle(x - w * 0.15, y - h * 0.2, Math.min(w, h) * 0.35);
  },

  flame(g, r, scale, flicker) {
    const s = r * scale;
    g.beginShape();
    g.vertex(0, s * 0.75);
    g.vertex(-s * 0.7, s * 0.2);
    g.vertex(-s * 0.55, -s * 0.45);
    g.vertex(-s * 0.15 + flicker, -s * 1.25);
    g.vertex(s * 0.05, -s * 0.6);
    g.vertex(s * 0.35 - flicker * 0.5, -s * 0.95);
    g.vertex(s * 0.7, -s * 0.15);
    g.vertex(s * 0.62, s * 0.35);
    g.endShape(CLOSE);
  },

  // ----- Esprits à sauver (r ≈ 12)
  SPIRITS: {
    bee: {
      cycle: 0.03,
      silhouette(g, r) {
        g.ellipse(0, 0, r * 1.75, r * 1.35);
        g.ellipse(-r * 0.25, -r * 0.75, r * 0.85, r * 0.6); g.ellipse(r * 0.25, -r * 0.8, r * 0.75, r * 0.55);
        g.triangle(-r * 0.8, -r * 0.12, -r * 0.8, r * 0.12, -r * 1.15, 0);
      },
      paint(g, r, now, phase) {
        const flap = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.03 + phase));
        g.fill(225, 243, 255, 230); g.ellipse(-r * 0.25, -r * 0.75, r * 0.85, r * 0.6 * flap); g.ellipse(r * 0.25, -r * 0.8, r * 0.75, r * 0.55 * flap);
        g.fill('#2a2018'); g.triangle(-r * 0.8, -r * 0.12, -r * 0.8, r * 0.12, -r * 1.15, 0);
        g.fill('#f8d040'); g.ellipse(0, 0, r * 1.75, r * 1.35);
        g.fill('#2a2018'); g.ellipse(-r * 0.2, 0, r * 0.24, r * 1.18); g.ellipse(-r * 0.55, 0, r * 0.2, r * 0.8);
        g.fill('#ffe680'); g.ellipse(-r * 0.05, -r * 0.35, r * 0.7, r * 0.25);
        CreatureArt.eye(g, r * 0.45, -r * 0.12, r * 0.42);
        g.fill(255, 140, 150, 160); g.circle(r * 0.55, r * 0.25, r * 0.22);
      },
    },
    fox: {
      silhouette(g, r) {
        g.ellipse(-r * 0.15, r * 0.15, r * 1.6, r * 1.0);
        g.circle(r * 0.5, -r * 0.3, r * 1.0);
        g.triangle(r * 0.15, -r * 0.55, r * 0.3, -r * 1.15, r * 0.55, -r * 0.65);
        g.triangle(r * 0.55, -r * 0.65, r * 0.8, -r * 1.15, r * 0.9, -r * 0.45);
        g.ellipse(-r * 0.95, -r * 0.15, r * 1.0, r * 0.55);
      },
      paint(g, r) {
        g.fill('#e8741c'); g.ellipse(-r * 0.95, -r * 0.15, r * 1.0, r * 0.55);
        g.fill('#fbf2e4'); g.ellipse(-r * 1.3, -r * 0.2, r * 0.38, r * 0.34);
        g.fill('#e8741c'); g.ellipse(-r * 0.15, r * 0.15, r * 1.6, r * 1.0); g.circle(r * 0.5, -r * 0.3, r * 1.0);
        g.triangle(r * 0.15, -r * 0.55, r * 0.3, -r * 1.15, r * 0.55, -r * 0.65); g.triangle(r * 0.55, -r * 0.65, r * 0.8, -r * 1.15, r * 0.9, -r * 0.45);
        g.fill('#7a3a12'); g.triangle(r * 0.27, -r * 0.65, r * 0.32, -r * 0.95, r * 0.45, -r * 0.68); g.triangle(r * 0.65, -r * 0.68, r * 0.78, -r * 0.95, r * 0.82, -r * 0.55);
        g.fill('#fbf2e4'); g.ellipse(r * 0.65, -r * 0.1, r * 0.75, r * 0.45); g.ellipse(r * 0.05, r * 0.35, r * 0.8, r * 0.4);
        CreatureArt.eye(g, r * 0.55, -r * 0.4, r * 0.3);
        g.fill('#201a16'); g.circle(r * 1.0, -r * 0.12, r * 0.16);
      },
    },
    rabbit: {
      silhouette(g, r) {
        g.ellipse(-r * 0.1, r * 0.2, r * 1.5, r * 1.1);
        g.circle(r * 0.45, -r * 0.25, r * 0.9);
        PaperArt.capsule(g, r * 0.3, -r * 0.55, r * 0.15, -r * 1.35, r * 0.3);
        PaperArt.capsule(g, r * 0.6, -r * 0.55, r * 0.75, -r * 1.3, r * 0.3);
        g.circle(-r * 0.85, r * 0.1, r * 0.45);
      },
      paint(g, r) {
        g.fill('#ecd9bc');
        PaperArt.capsule(g, r * 0.3, -r * 0.55, r * 0.15, -r * 1.35, r * 0.3); PaperArt.capsule(g, r * 0.6, -r * 0.55, r * 0.75, -r * 1.3, r * 0.3);
        g.fill('#f3a6a6'); PaperArt.capsule(g, r * 0.29, -r * 0.65, r * 0.18, -r * 1.25, r * 0.12); PaperArt.capsule(g, r * 0.61, -r * 0.65, r * 0.72, -r * 1.2, r * 0.12);
        g.fill('#ecd9bc'); g.ellipse(-r * 0.1, r * 0.2, r * 1.5, r * 1.1); g.circle(r * 0.45, -r * 0.25, r * 0.9);
        g.fill('#ffffff'); g.circle(-r * 0.85, r * 0.1, r * 0.45); g.ellipse(-r * 0.05, r * 0.45, r * 0.8, r * 0.35);
        CreatureArt.eye(g, r * 0.55, -r * 0.32, r * 0.3);
        g.fill('#e87a8a'); g.circle(r * 0.88, -r * 0.15, r * 0.16);
      },
    },
    ember: {
      cycle: 0.012,
      silhouette(g, r, now, phase) { CreatureArt.flame(g, r, 1.15, Math.sin(now * 0.012 + phase) * r * 0.12); },
      paint(g, r, now, phase) {
        const flicker = Math.sin(now * 0.012 + phase) * r * 0.12;
        g.fill('#e8481a'); CreatureArt.flame(g, r, 1.15, flicker);
        g.fill('#ffa020'); g.push(); g.translate(0, r * 0.12); CreatureArt.flame(g, r, 0.8, flicker * 0.7); g.pop();
        g.fill('#fff08a'); g.push(); g.translate(0, r * 0.3); CreatureArt.flame(g, r, 0.45, flicker * 0.4); g.pop();
        g.fill('#5a1a08'); g.circle(-r * 0.15, r * 0.05, r * 0.18); g.circle(r * 0.25, r * 0.05, r * 0.18);
      },
    },
    bird: {
      cycle: 0.02,
      silhouette(g, r) {
        g.circle(0, 0, r * 1.6);
        g.triangle(-r * 0.6, -r * 0.1, -r * 1.25, -r * 0.45, -r * 1.15, r * 0.3);
        g.triangle(r * 0.7, -r * 0.15, r * 1.15, 0, r * 0.7, r * 0.15);
      },
      paint(g, r, now, phase) {
        g.fill('#3d8fe0'); g.triangle(-r * 0.6, -r * 0.1, -r * 1.25, -r * 0.45, -r * 1.15, r * 0.3);
        g.fill('#ffd84a'); g.triangle(r * 0.7, -r * 0.15, r * 1.15, 0, r * 0.7, r * 0.15);
        g.fill('#5fb4ff'); g.circle(0, 0, r * 1.6);
        g.fill('#e6f4ff'); g.ellipse(r * 0.15, r * 0.35, r * 1.0, r * 0.65);
        g.push(); g.translate(-r * 0.15, 0); g.rotate(Math.sin(now * 0.02 + phase) * 0.5);
        g.fill('#3d8fe0'); g.ellipse(-r * 0.2, -r * 0.1, r * 0.95, r * 0.5); g.pop();
        CreatureArt.eye(g, r * 0.35, -r * 0.25, r * 0.34);
      },
    },
    fish: {
      cycle: 0.012,
      silhouette(g, r, now, phase) {
        const wiggle = Math.sin(now * 0.012 + phase) * r * 0.15;
        g.ellipse(0, 0, r * 1.85, r * 1.25);
        g.triangle(-r * 0.75, 0, -r * 1.35, -r * 0.6 + wiggle, -r * 1.35, r * 0.6 + wiggle);
        g.triangle(-r * 0.3, -r * 0.5, r * 0.25, -r * 0.5, -r * 0.1, -r * 0.95);
      },
      paint(g, r, now, phase) {
        const wiggle = Math.sin(now * 0.012 + phase) * r * 0.15;
        g.fill('#ffd060'); g.triangle(-r * 0.75, 0, -r * 1.35, -r * 0.6 + wiggle, -r * 1.35, r * 0.6 + wiggle); g.triangle(-r * 0.3, -r * 0.5, r * 0.25, -r * 0.5, -r * 0.1, -r * 0.95);
        g.fill('#ff9a2a'); g.ellipse(0, 0, r * 1.85, r * 1.25);
        g.fill('#fff3e0'); g.ellipse(-r * 0.15, 0, r * 0.28, r * 1.1); g.ellipse(-r * 0.5, 0, r * 0.18, r * 0.75);
        g.fill('#ffd060'); g.ellipse(r * 0.05, r * 0.3, r * 0.45, r * 0.22);
        CreatureArt.eye(g, r * 0.45, -r * 0.12, r * 0.38);
      },
    },
    firefly: {
      cycle: 0.008,
      silhouette(g, r) {
        g.ellipse(-r * 0.15, 0, r * 1.5, r * 0.95); g.circle(r * 0.55, -r * 0.05, r * 0.7);
        g.ellipse(-r * 0.1, -r * 0.6, r * 0.9, r * 0.5);
      },
      paint(g, r, now, phase) {
        const shine = 0.5 + 0.5 * Math.sin(now * 0.008 + phase);
        g.fill(220, 236, 255, 220); g.ellipse(-r * 0.1, -r * 0.6, r * 0.9, r * 0.5);
        g.fill('#3a2a22'); g.ellipse(-r * 0.15, 0, r * 1.5, r * 0.95); g.circle(r * 0.55, -r * 0.05, r * 0.7);
        g.fill(255, 243, 160, 190 + shine * 65); g.ellipse(-r * 0.45, r * 0.05, r * 0.85, r * 0.75);
        CreatureArt.eye(g, r * 0.62, -r * 0.1, r * 0.3);
      },
    },
  },

  // ----- Veilleurs (r ≈ 13–15) : tous originaux, tous tournés vers la droite.
  GUARDIANS: {
    bramble: {
      cycle: 0.0032,
      eye: '#ffb347',
      silhouette(g, r, now, phase) {
        const breath = 1 + Math.sin(now * 0.0032 + phase) * 0.06;
        PaperArt.star(g, 0, 0, r * 1.25 * breath, r * 0.88, 11, phase);
        g.ellipse(-r * 0.4, r * 0.95, r * 0.5, r * 0.3); g.ellipse(r * 0.4, r * 0.95, r * 0.5, r * 0.3);
      },
      paint(g, r, now, phase, eye) {
        const breath = 1 + Math.sin(now * 0.0032 + phase) * 0.06;
        g.fill('#2a2036'); g.ellipse(-r * 0.4, r * 0.95, r * 0.5, r * 0.3); g.ellipse(r * 0.4, r * 0.95, r * 0.5, r * 0.3);
        g.fill('#3b2d4a'); PaperArt.star(g, 0, 0, r * 1.25 * breath, r * 0.88, 11, phase);
        g.fill('#57406a'); g.circle(-r * 0.1, -r * 0.1, r * 1.45);
        g.fill('#7e9a5a'); g.ellipse(-r * 0.45, -r * 0.6, r * 0.45, r * 0.2); g.ellipse(r * 0.5, -r * 0.5, r * 0.35, r * 0.16);
        CreatureArt.glowEye(g, -r * 0.1, -r * 0.15, r * 0.32, r * 0.4, eye);
        CreatureArt.glowEye(g, r * 0.38, -r * 0.15, r * 0.32, r * 0.4, eye);
        g.fill('#1a1222'); g.triangle(-r * 0.2, r * 0.3, r * 0.5, r * 0.3, r * 0.15, r * 0.5);
      },
    },
    'frost-lynx': {
      cycle: 0.015,
      eye: '#9ff3ff',
      silhouette(g, r, now, phase) {
        const step = Math.sin(now * 0.015 + phase) * r * 0.12;
        g.ellipse(-r * 0.15, r * 0.15, r * 1.9, r * 1.0);
        g.circle(r * 0.75, -r * 0.3, r * 1.05);
        g.triangle(r * 0.35, -r * 0.6, r * 0.45, -r * 1.3, r * 0.75, -r * 0.75);
        g.triangle(r * 0.85, -r * 0.75, r * 1.15, -r * 1.3, r * 1.2, -r * 0.55);
        PaperArt.capsule(g, -r * 0.95, -r * 0.05, -r * 1.35, -r * 0.6, r * 0.28);
        PaperArt.capsule(g, -r * 0.6, r * 0.45, -r * 0.65 - step, r * 0.95, r * 0.28); PaperArt.capsule(g, r * 0.35, r * 0.45, r * 0.4 + step, r * 0.95, r * 0.28);
      },
      paint(g, r, now, phase, eye) {
        const step = Math.sin(now * 0.015 + phase) * r * 0.12;
        g.fill('#465673');
        PaperArt.capsule(g, -r * 0.95, -r * 0.05, -r * 1.35, -r * 0.6, r * 0.28);
        PaperArt.capsule(g, -r * 0.6, r * 0.45, -r * 0.65 - step, r * 0.95, r * 0.28); PaperArt.capsule(g, r * 0.35, r * 0.45, r * 0.4 + step, r * 0.95, r * 0.28);
        g.fill('#5d6f8f'); g.ellipse(-r * 0.15, r * 0.15, r * 1.9, r * 1.0); g.circle(r * 0.75, -r * 0.3, r * 1.05);
        g.triangle(r * 0.35, -r * 0.6, r * 0.45, -r * 1.3, r * 0.75, -r * 0.75); g.triangle(r * 0.85, -r * 0.75, r * 1.15, -r * 1.3, r * 1.2, -r * 0.55);
        g.fill('#c9d6ea'); g.ellipse(-r * 0.05, r * 0.4, r * 1.2, r * 0.38); g.ellipse(r * 0.95, -r * 0.1, r * 0.6, r * 0.42);
        g.fill('#2f3a52'); g.triangle(r * 0.45, -r * 1.3, r * 0.42, -r * 1.55, r * 0.52, -r * 1.25); g.triangle(r * 1.15, -r * 1.3, r * 1.2, -r * 1.55, r * 1.08, -r * 1.27);
        g.rect(-r * 0.55, -r * 0.3, r * 0.12, r * 0.4, 2); g.rect(-r * 0.2, -r * 0.33, r * 0.12, r * 0.42, 2); g.rect(r * 0.15, -r * 0.3, r * 0.12, r * 0.38, 2);
        CreatureArt.glowEye(g, r * 0.62, -r * 0.42, r * 0.3, r * 0.2, eye);
        CreatureArt.glowEye(g, r * 1.0, -r * 0.42, r * 0.26, r * 0.18, eye);
      },
    },
    'dune-scorpion': {
      cycle: 0.008,
      eye: '#ffd166',
      tail(g, r, now, phase, thickness) {
        const curl = Math.sin(now * 0.008 + phase) * 0.15;
        const points = [[-r * 0.65, -r * 0.05], [-r * 1.05, -r * 0.45], [-r * 1.05, -r * (1.0 + curl)], [-r * 0.6, -r * (1.35 + curl)], [-r * 0.15, -r * (1.25 + curl)]];
        for (let i = 1; i < points.length; i++) PaperArt.capsule(g, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], r * thickness * (1 - i * 0.12));
        return points[points.length - 1];
      },
      silhouette(g, r, now, phase) {
        g.ellipse(0, 0, r * 1.55, r * 0.95);
        this.tail(g, r, now, phase, 0.38);
        PaperArt.capsule(g, r * 0.5, -r * 0.1, r * 1.1, -r * 0.35, r * 0.24); PaperArt.capsule(g, r * 0.5, r * 0.15, r * 1.1, r * 0.35, r * 0.24);
        g.circle(r * 1.25, -r * 0.42, r * 0.5); g.circle(r * 1.25, r * 0.42, r * 0.5);
        for (const x of [-0.4, 0, 0.35]) PaperArt.capsule(g, x * r, r * 0.3, x * r - r * 0.15, r * 0.8, r * 0.14);
      },
      paint(g, r, now, phase, eye) {
        g.fill('#542c1c'); for (const x of [-0.4, 0, 0.35]) PaperArt.capsule(g, x * r, r * 0.3, x * r - r * 0.15, r * 0.8, r * 0.14);
        g.fill('#6b3a26');
        const tip = this.tail(g, r, now, phase, 0.38);
        PaperArt.capsule(g, r * 0.5, -r * 0.1, r * 1.1, -r * 0.35, r * 0.24); PaperArt.capsule(g, r * 0.5, r * 0.15, r * 1.1, r * 0.35, r * 0.24);
        g.circle(r * 1.25, -r * 0.42, r * 0.5); g.circle(r * 1.25, r * 0.42, r * 0.5);
        g.ellipse(0, 0, r * 1.55, r * 0.95);
        g.fill('#8d5236'); g.ellipse(-r * 0.1, -r * 0.15, r * 1.1, r * 0.45);
        g.fill('#c98c4b'); g.triangle(r * 1.35, -r * 0.45, r * 1.6, -r * 0.5, r * 1.4, -r * 0.3); g.triangle(r * 1.35, r * 0.45, r * 1.6, r * 0.5, r * 1.4, r * 0.3);
        g.fill('#ffb347'); g.triangle(tip[0], tip[1] - r * 0.18, tip[0] + r * 0.35, tip[1] + r * 0.05, tip[0], tip[1] + r * 0.18);
        CreatureArt.glowEye(g, r * 0.45, -r * 0.25, r * 0.2, r * 0.2, eye);
        CreatureArt.glowEye(g, r * 0.7, -r * 0.2, r * 0.18, r * 0.18, eye);
      },
    },
    'ash-moth': {
      cycle: 0.009,
      eye: '#ffc15e',
      wings(g, r, now, phase, inset = 0) {
        const flap = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.009 + phase));
        g.push(); g.rotate(-0.5); g.ellipse(-r * 0.55, -r * 0.55 * flap, r * 1.5 - inset, r * 1.1 * flap - inset); g.pop();
        g.push(); g.rotate(0.45); g.ellipse(-r * 0.6, r * 0.35 * flap, r * 1.1 - inset, r * 0.8 * flap - inset); g.pop();
      },
      silhouette(g, r, now, phase) {
        this.wings(g, r, now, phase);
        PaperArt.capsule(g, -r * 0.55, 0, r * 0.55, 0, r * 0.5);
        PaperArt.capsule(g, r * 0.55, -r * 0.15, r * 1.0, -r * 0.7, r * 0.12);
      },
      paint(g, r, now, phase, eye) {
        g.fill('#ff8a3d'); this.wings(g, r, now, phase);
        g.fill('#6b5a66'); this.wings(g, r, now, phase, r * 0.22);
        g.fill('#ffc15e'); g.circle(-r * 0.75, -r * 0.55, r * 0.32);
        g.fill('#3f3239'); PaperArt.capsule(g, -r * 0.55, 0, r * 0.55, 0, r * 0.5);
        g.fill('#7a6872'); for (const x of [-0.3, 0, 0.3]) g.rect(x * r - r * 0.04, -r * 0.22, r * 0.08, r * 0.44);
        g.fill('#2a2226'); PaperArt.capsule(g, r * 0.55, -r * 0.15, r * 1.0, -r * 0.7, r * 0.12);
        CreatureArt.glowEye(g, r * 0.6, -r * 0.05, r * 0.26, r * 0.26, eye);
      },
    },
    'storm-ray': {
      cycle: 0.006,
      eye: '#e8f4ff',
      body(g, r, now, phase) {
        const wave = Math.sin(now * 0.006 + phase) * r * 0.35;
        g.beginShape();
        g.vertex(r * 1.0, 0); g.vertex(r * 0.2, -r * 0.45); g.vertex(-r * 0.25, -r * 1.15 + wave); g.vertex(-r * 0.55, -r * 0.3);
        g.vertex(-r * 0.75, 0); g.vertex(-r * 0.55, r * 0.3); g.vertex(-r * 0.25, r * 1.0 - wave * 0.6); g.vertex(r * 0.2, r * 0.45);
        g.endShape(CLOSE);
      },
      silhouette(g, r, now, phase) {
        this.body(g, r, now, phase);
        PaperArt.capsule(g, -r * 0.7, 0, -r * 1.55, Math.sin(now * 0.006 + phase) * r * 0.2, r * 0.12);
      },
      paint(g, r, now, phase, eye) {
        g.fill('#1f2858'); PaperArt.capsule(g, -r * 0.7, 0, -r * 1.55, Math.sin(now * 0.006 + phase) * r * 0.2, r * 0.12);
        g.fill('#2f3a78'); this.body(g, r, now, phase);
        g.fill('#4a59a8'); g.ellipse(r * 0.1, r * 0.05, r * 1.0, r * 0.45);
        const spark = 0.5 + 0.5 * Math.sin(now * 0.02 + phase);
        g.noFill(); g.stroke(255, 209, 102, 170 + spark * 85); g.strokeWeight(r * 0.1);
        g.line(-r * 0.15, -r * 0.6, r * 0.05, -r * 0.3); g.line(r * 0.05, -r * 0.3, -r * 0.1, -r * 0.15); g.line(-r * 0.1, -r * 0.15, r * 0.15, r * 0.15);
        g.noStroke();
        CreatureArt.glowEye(g, r * 0.6, -r * 0.12, r * 0.2, r * 0.2, eye);
        CreatureArt.glowEye(g, r * 0.6, r * 0.12, r * 0.2, r * 0.2, eye);
      },
    },
    'lantern-angler': {
      cycle: 0.008,
      eye: '#ffef9a',
      silhouette(g, r, now, phase) {
        const tail = Math.sin(now * 0.008 + phase) * r * 0.2;
        g.circle(0, 0, r * 1.75);
        g.triangle(-r * 0.75, 0, -r * 1.35, -r * 0.6 + tail, -r * 1.35, r * 0.6 + tail);
        PaperArt.capsule(g, r * 0.05, -r * 0.82, r * 0.6, -r * 1.35, r * 0.1); PaperArt.capsule(g, r * 0.6, -r * 1.35, r * 1.05, -r * 1.05, r * 0.1);
        g.circle(r * 1.1, -r * 0.95, r * 0.42);
      },
      paint(g, r, now, phase, eye) {
        const tail = Math.sin(now * 0.008 + phase) * r * 0.2;
        const lure = 0.5 + 0.5 * Math.sin(now * 0.005 + phase);
        g.fill('#141a2c'); g.triangle(-r * 0.75, 0, -r * 1.35, -r * 0.6 + tail, -r * 1.35, r * 0.6 + tail);
        g.fill('#1b2238'); g.circle(0, 0, r * 1.75);
        g.fill('#2c3656'); g.ellipse(-r * 0.1, r * 0.35, r * 1.2, r * 0.6);
        g.fill('#0a0d18'); g.arc(r * 0.45, r * 0.18, r * 0.95, r * 0.75, -0.2, Math.PI * 0.75);
        g.fill('#ffffff'); for (let i = 0; i < 4; i++) g.triangle(r * (0.2 + i * 0.16), r * 0.2, r * (0.28 + i * 0.16), r * 0.38, r * (0.36 + i * 0.16), r * 0.2);
        g.fill('#2c3656'); PaperArt.capsule(g, r * 0.05, -r * 0.82, r * 0.6, -r * 1.35, r * 0.1); PaperArt.capsule(g, r * 0.6, -r * 1.35, r * 1.05, -r * 1.05, r * 0.1);
        g.fill(94, 242, 214, 70 + lure * 80); g.circle(r * 1.1, -r * 0.95, r * 1.1);
        g.fill('#5ef2d6'); g.circle(r * 1.1, -r * 0.95, r * 0.42);
        g.fill('#e8fffb'); g.circle(r * 1.05, -r * 1.0, r * 0.16);
        CreatureArt.glowEye(g, r * 0.3, -r * 0.3, r * 0.34, r * 0.34, eye);
      },
    },
  },

  // ----- Avatars du joueur (r ≈ 12), choisis sur l'écran d'accueil.
  AVATARS: {
    firefly: {
      glow: [255, 214, 90],
      silhouette(g, r) {
        g.ellipse(-r * 0.35, -r * 0.65, r * 1.1, r * 0.6); g.ellipse(r * 0.25, -r * 0.7, r * 1.0, r * 0.55);
        g.ellipse(-r * 0.25, r * 0.1, r * 1.5, r * 1.15); g.circle(r * 0.6, -r * 0.15, r * 0.85);
      },
      paint(g, r, now) {
        const flap = 0.6 + 0.4 * Math.abs(Math.sin(now * 0.025));
        g.fill(210, 240, 255, 230); g.ellipse(-r * 0.35, -r * 0.65, r * 1.1, r * 0.6 * flap); g.ellipse(r * 0.25, -r * 0.7, r * 1.0, r * 0.55 * flap);
        g.fill('#ffb020'); g.ellipse(-r * 0.25, r * 0.1, r * 1.5, r * 1.15);
        g.fill('#fff3a0'); g.ellipse(-r * 0.4, r * 0.15, r * 0.95, r * 0.75);
        g.fill('#3a2a22'); g.circle(r * 0.6, -r * 0.15, r * 0.85);
        CreatureArt.eye(g, r * 0.7, -r * 0.2, r * 0.36);
        g.fill('#3a2a22'); PaperArt.capsule(g, r * 0.65, -r * 0.5, r * 0.85, -r * 1.05, r * 0.08);
        g.fill('#fff3a0'); g.circle(r * 0.88, -r * 1.1, r * 0.2);
      },
    },
    butterfly: {
      glow: [255, 150, 220],
      wings(g, r, flap, inset = 0) {
        g.ellipse(-r * 0.5, -r * 0.5, (r * 1.2 - inset) * flap, r * 1.15 - inset); g.ellipse(r * 0.5, -r * 0.5, (r * 1.2 - inset) * flap, r * 1.15 - inset);
        g.ellipse(-r * 0.4, r * 0.45, (r * 0.85 - inset) * flap, r * 0.8 - inset); g.ellipse(r * 0.4, r * 0.45, (r * 0.85 - inset) * flap, r * 0.8 - inset);
      },
      silhouette(g, r, now) { this.wings(g, r, 0.75 + 0.25 * Math.abs(Math.sin(now * 0.02))); PaperArt.capsule(g, 0, -r * 0.7, 0, r * 0.75, r * 0.32); },
      paint(g, r, now) {
        const flap = 0.75 + 0.25 * Math.abs(Math.sin(now * 0.02));
        g.fill('#ff5fa8'); this.wings(g, r, flap);
        g.fill('#7fe3ff'); this.wings(g, r, flap, r * 0.45);
        g.fill('#fff4c2'); g.circle(-r * 0.55, -r * 0.6, r * 0.22); g.circle(r * 0.55, -r * 0.6, r * 0.22);
        g.fill('#3a2348'); PaperArt.capsule(g, 0, -r * 0.7, 0, r * 0.75, r * 0.32);
        PaperArt.capsule(g, 0, -r * 0.8, -r * 0.35, -r * 1.3, r * 0.07); PaperArt.capsule(g, 0, -r * 0.8, r * 0.35, -r * 1.3, r * 0.07);
        CreatureArt.eye(g, 0, -r * 0.55, r * 0.26);
      },
    },
    star: {
      glow: [255, 220, 110],
      silhouette(g, r) { PaperArt.star(g, 0, 0, r * 1.35, r * 0.62, 5); },
      paint(g, r, now) {
        g.fill('#ffbe3b'); PaperArt.star(g, 0, 0, r * 1.35, r * 0.62, 5);
        g.fill('#ffe28a'); PaperArt.star(g, -r * 0.06, -r * 0.08, r * 0.95, r * 0.44, 5);
        const blink = Math.sin(now * 0.002) > 0.96 ? 0.2 : 1;
        g.fill('#5a3410'); g.ellipse(-r * 0.25, -r * 0.05, r * 0.16, r * 0.26 * blink); g.ellipse(r * 0.22, -r * 0.05, r * 0.16, r * 0.26 * blink);
        g.fill(255, 140, 120, 170); g.circle(-r * 0.45, r * 0.2, r * 0.2); g.circle(r * 0.42, r * 0.2, r * 0.2);
      },
    },
    moon: {
      glow: [200, 180, 255],
      crescent(g, r, scale = 1) {
        const outer = r * 1.25 * scale;
        g.beginShape();
        for (let i = 0; i <= 20; i++) {
          const angle = -2.2 + 4.4 * i / 20;
          g.vertex(Math.cos(angle + Math.PI) * outer + r * 0.15, Math.sin(angle + Math.PI) * outer);
        }
        for (let i = 20; i >= 0; i--) {
          const angle = -1.75 + 3.5 * i / 20;
          g.vertex(Math.cos(angle + Math.PI) * outer * 0.85 + r * 0.6 * scale, Math.sin(angle + Math.PI) * outer * 0.8 - r * 0.05);
        }
        g.endShape(CLOSE);
      },
      silhouette(g, r) { this.crescent(g, r); },
      paint(g, r) {
        g.fill('#c8b4ff'); this.crescent(g, r);
        g.fill('#e6dcff'); this.crescent(g, r, 0.8);
        g.fill('#a58ce8'); g.circle(-r * 0.75, r * 0.35, r * 0.22); g.circle(-r * 0.55, -r * 0.55, r * 0.16);
        g.fill('#3a2a6a'); g.ellipse(-r * 0.62, -r * 0.08, r * 0.14, r * 0.22);
        g.fill(255, 160, 200, 170); g.circle(-r * 0.7, r * 0.15, r * 0.18);
      },
    },
    crystal: {
      glow: [120, 230, 255],
      gem(g, r, scale = 1) {
        const s = r * scale;
        g.beginShape(); g.vertex(0, -s * 1.3); g.vertex(s * 0.8, -s * 0.45); g.vertex(s * 0.55, s * 0.85); g.vertex(0, s * 1.15); g.vertex(-s * 0.55, s * 0.85); g.vertex(-s * 0.8, -s * 0.45); g.endShape(CLOSE);
      },
      silhouette(g, r) { this.gem(g, r); },
      paint(g, r) {
        g.fill('#3fa8d8'); this.gem(g, r);
        g.fill('#7fd8f6'); g.triangle(0, -r * 1.3, -r * 0.8, -r * 0.45, 0, r * 0.1); g.triangle(0, -r * 1.3, r * 0.8, -r * 0.45, 0, r * 0.1);
        g.fill('#d6f6ff'); g.triangle(0, -r * 1.3, -r * 0.8, -r * 0.45, -r * 0.2, -r * 0.35);
        CreatureArt.eye(g, -r * 0.22, r * 0.35, r * 0.26); CreatureArt.eye(g, r * 0.22, r * 0.35, r * 0.26);
      },
    },
    leaf: {
      glow: [160, 240, 140],
      shape(g, r, scale = 1) {
        const s = r * scale;
        g.beginShape();
        for (let i = 0; i <= 16; i++) { const t = i / 16; g.vertex(-s * 1.2 + s * 2.4 * t, -s * 0.62 * Math.sin(Math.PI * t)); }
        for (let i = 16; i >= 0; i--) { const t = i / 16; g.vertex(-s * 1.2 + s * 2.4 * t, s * 0.62 * Math.sin(Math.PI * t)); }
        g.endShape(CLOSE);
      },
      silhouette(g, r, now) { g.push(); g.rotate(-0.5 + Math.sin(now * 0.004) * 0.08); this.shape(g, r); PaperArt.capsule(g, -r * 1.15, 0, -r * 1.55, r * 0.15, r * 0.12); g.pop(); },
      paint(g, r, now) {
        g.push(); g.rotate(-0.5 + Math.sin(now * 0.004) * 0.08);
        g.fill('#3f9d4a'); PaperArt.capsule(g, -r * 1.15, 0, -r * 1.55, r * 0.15, r * 0.12);
        g.fill('#5cbf58'); this.shape(g, r);
        g.fill('#8fe07e'); this.shape(g, r, 0.62);
        g.fill('#3f9d4a'); g.rect(-r * 1.0, -r * 0.04, r * 2.0, r * 0.08);
        g.pop();
        CreatureArt.eye(g, r * 0.0, -r * 0.1, r * 0.28); CreatureArt.eye(g, r * 0.38, -r * 0.3, r * 0.26);
      },
    },
  },
};
