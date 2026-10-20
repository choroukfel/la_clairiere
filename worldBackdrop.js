// Fond « diorama de papier » vu de dessus : sol, collines en couches découpées,
// élément de relief (rivière, lac, coulée de lave, vent, chenal de sable) et détails.
// La mise en page est déterministe par lieu (graine = identifiant du lieu) et
// normalisée, pour rester identique après un redimensionnement.
const WorldBackdrop = {
  cache: null,
  layouts: {},
  geometries: {},
  HILL_COUNT: 11,
  DETAIL_COUNT: 260,
  GRAIN_COUNT: 900,

  layout(id, definition) {
    if (this.layouts[id]) return this.layouts[id];
    const rand = PaperArt.rng(PaperArt.hash(`backdrop:${id}`));
    const hills = [];
    for (let i = 0; i < this.HILL_COUNT; i++) {
      hills.push({
        x: rand(), y: rand(), radius: 0.07 + rand() * 0.11,
        layers: 2 + Math.floor(rand() * 2), shape: PaperArt.blob(rand, 1, 0.24, 30),
      });
    }
    const feature = this.featureLayout(definition.backdrop.feature, rand);
    const details = [];
    for (let i = 0; i < this.DETAIL_COUNT; i++) {
      details.push({ x: rand(), y: rand(), size: 0.6 + rand() * 0.8, angle: rand() * Math.PI * 2, variant: Math.floor(rand() * 3) });
    }
    const grain = [];
    for (let i = 0; i < this.GRAIN_COUNT; i++) grain.push({ x: rand(), y: rand(), light: rand() < 0.5 });
    this.layouts[id] = { hills, feature, details, grain };
    return this.layouts[id];
  },

  featureLayout(type, rand) {
    const tau = Math.PI * 2;
    if (type === 'river' || type === 'lava-river' || type === 'sand-channel') {
      const base = 0.35 + rand() * 0.3;
      const amplitude = 0.12 + rand() * 0.08;
      const frequency = 4 + rand() * 3;
      const phase = rand() * tau;
      const ripple = 0.04 + rand() * 0.04;
      const ripplePhase = rand() * tau;
      const points = [];
      for (let i = 0; i <= 48; i++) {
        const t = -0.06 + i * (1.12 / 48);
        points.push({ x: t, y: base + amplitude * Math.sin(t * frequency + phase) + ripple * Math.sin(t * frequency * 2.3 + ripplePhase) });
      }
      return { type, points, width: type === 'sand-channel' ? 0.075 : 0.05 };
    }
    if (type === 'lake') {
      const cracks = [];
      for (let i = 0; i < 7; i++) cracks.push({ angle: rand() * tau, length: 0.35 + rand() * 0.5 });
      return { type, x: 0.42 + rand() * 0.16, y: 0.5 + rand() * 0.14, radius: 0.15 + rand() * 0.04, shape: PaperArt.blob(rand, 1, 0.16, 36), cracks };
    }
    const strips = [];
    for (let i = 0; i < 4; i++) {
      strips.push({ y: 0.15 + i * 0.22 + rand() * 0.06, amplitude: 0.02 + rand() * 0.03, frequency: 3 + rand() * 3, phase: rand() * tau, from: rand() * 0.3, to: 0.7 + rand() * 0.3 });
    }
    return { type: 'wind', strips };
  },

  // Géométrie en pixels pour une taille d'écran donnée (mise en cache).
  geometry(id, definition, w, h) {
    const key = `${id}:${Math.round(w)}x${Math.round(h)}`;
    if (this.geometries[key]) return this.geometries[key];
    if (Object.keys(this.geometries).length > 16) this.geometries = {};
    const layout = this.layout(id, definition);
    const unit = Math.min(w, h);
    const feature = layout.feature;
    let path = null;
    let strips = null;
    let lake = null;
    if (feature.points) {
      const points = feature.points.map(point => ({ x: point.x * w, y: point.y * h }));
      const lengths = [0];
      for (let i = 1; i < points.length; i++) {
        lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
      }
      path = { points, lengths, total: lengths[lengths.length - 1], width: feature.width * unit };
    } else if (feature.type === 'lake') {
      lake = { x: feature.x * w, y: feature.y * h, radius: feature.radius * unit, shape: feature.shape, cracks: feature.cracks };
    } else {
      strips = feature.strips.map(strip => {
        const points = [];
        for (let k = 0; k <= 30; k++) {
          const t = strip.from + (strip.to - strip.from) * k / 30;
          points.push({ x: t * w, y: (strip.y + strip.amplitude * Math.sin(t * strip.frequency * Math.PI + strip.phase)) * h });
        }
        return points;
      });
    }
    this.geometries[key] = { layout, unit, path, strips, lake };
    return this.geometries[key];
  },

  // Point situé à une fraction de la longueur du chemin, avec sa tangente.
  pointAlong(path, fraction) {
    const target = PaperArt.clamp(fraction, 0, 1) * path.total;
    let index = 1;
    while (index < path.lengths.length - 1 && path.lengths[index] < target) index++;
    const a = path.points[index - 1];
    const b = path.points[index];
    const span = Math.max(0.0001, path.lengths[index] - path.lengths[index - 1]);
    const t = PaperArt.clamp((target - path.lengths[index - 1]) / span, 0, 1);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, nx: -Math.sin(angle), ny: Math.cos(angle) };
  },

  distanceToFeature(geometry, x, y) {
    if (geometry.path) {
      let best = Infinity;
      for (const point of geometry.path.points) best = Math.min(best, Math.hypot(point.x - x, point.y - y));
      return best - geometry.path.width;
    }
    if (geometry.lake) return Math.hypot(geometry.lake.x - x, geometry.lake.y - y) - geometry.lake.radius * 1.15;
    return Infinity;
  },

  // Dessine le fond depuis un tampon peint une seule fois par lieu et par taille.
  drawCached(id, definition, w, h) {
    if (typeof createGraphics !== 'function' || typeof image !== 'function') return false;
    const key = `${id}:${Math.round(w)}x${Math.round(h)}`;
    if (!this.cache || this.cache.key !== key) {
      if (this.cache?.buffer?.remove) this.cache.buffer.remove();
      const buffer = createGraphics(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
      this.paint(buffer, id, definition, w, h);
      this.cache = { key, buffer };
    }
    image(this.cache.buffer, 0, 0, w, h);
    return true;
  },

  paint(g, id, definition, w, h) {
    const palette = definition.palette;
    const geometry = this.geometry(id, definition, w, h);
    g.push();
    g.noStroke();
    g.fill(palette.ground);
    g.rect(0, 0, w, h);
    this.paintGrain(g, geometry.layout.grain, palette, w, h);
    this.paintHills(g, geometry, palette, w, h);
    this.paintFeature(g, geometry, palette, definition.backdrop);
    this.paintDetails(g, geometry, palette, definition.backdrop.details, w, h);
    this.paintVignette(g, palette, w, h);
    g.pop();
  },

  // Grain du papier : de minuscules fibres claires et sombres.
  paintGrain(g, grain, palette, w, h) {
    const light = PaperArt.rgb(PaperArt.mix(palette.ground, '#ffffff', 0.35));
    const dark = PaperArt.rgb(PaperArt.shade(palette.ground, 0.7));
    g.noStroke();
    for (const fiber of grain) {
      g.fill(...(fiber.light ? light : dark), 40);
      g.rect(fiber.x * w, fiber.y * h, 2, 1);
    }
  },

  paintHills(g, geometry, palette, w, h) {
    const shadow = PaperArt.SHADOW.slice(0, 3);
    for (const hill of geometry.layout.hills) {
      const x = hill.x * w;
      const y = hill.y * h;
      const radius = hill.radius * geometry.unit;
      for (let layer = 0; layer < hill.layers; layer++) {
        const scale = radius * (1 - layer * 0.27);
        const ox = x - layer * radius * 0.06;
        const oy = y - layer * radius * 0.08;
        g.fill(...shadow, 46);
        PaperArt.polygon(g, hill.shape, ox + 3, oy + 4, scale);
        g.fill(palette.hills[Math.min(palette.hills.length - 1, layer)]);
        PaperArt.polygon(g, hill.shape, ox, oy, scale);
      }
    }
  },

  strokePath(g, points, rgb, alpha, weight, dx = 0, dy = 0) {
    g.noFill();
    g.stroke(...rgb, alpha);
    g.strokeWeight(weight);
    g.beginShape();
    for (const point of points) g.vertex(point.x + dx, point.y + dy);
    g.endShape();
  },

  paintFeature(g, geometry, palette, backdrop) {
    const { bank, water, light } = palette.feature;
    const shadow = PaperArt.SHADOW.slice(0, 3);
    if (geometry.path) {
      const { points, width } = geometry.path;
      const lava = backdrop.feature === 'lava-river';
      this.strokePath(g, points, shadow, 60, width * 1.8, 3, 4);
      this.strokePath(g, points, PaperArt.rgb(bank), 255, width * (lava ? 1.9 : 1.7));
      if (lava) this.strokePath(g, points, PaperArt.rgb(water), 90, width * 1.4);
      this.strokePath(g, points, PaperArt.rgb(water), 255, width);
      this.strokePath(g, points, PaperArt.rgb(light), lava ? 220 : 150, width * 0.34, -width * 0.12, -width * 0.16);
    } else if (geometry.lake) {
      const { x, y, radius, shape, cracks } = geometry.lake;
      g.noStroke();
      g.fill(...shadow, 60);
      PaperArt.polygon(g, shape, x + 3, y + 4, radius * 1.14);
      g.fill(bank);
      PaperArt.polygon(g, shape, x, y, radius * 1.14);
      g.fill(water);
      PaperArt.polygon(g, shape, x, y, radius);
      g.fill(...PaperArt.rgb(light), 170);
      PaperArt.polygon(g, shape, x - radius * 0.08, y - radius * 0.1, radius * 0.7);
      if (backdrop.frozen) {
        g.stroke(255, 255, 255, 170);
        g.strokeWeight(1.2);
        for (const crack of cracks) {
          const mx = x + Math.cos(crack.angle) * radius * crack.length * 0.5;
          const my = y + Math.sin(crack.angle) * radius * crack.length * 0.5;
          g.line(x + Math.cos(crack.angle) * radius * 0.1, y + Math.sin(crack.angle) * radius * 0.1, mx + 4, my - 3);
          g.line(mx + 4, my - 3, x + Math.cos(crack.angle) * radius * crack.length, y + Math.sin(crack.angle) * radius * crack.length);
        }
        g.noStroke();
      }
    } else if (geometry.strips) {
      for (const strip of geometry.strips) {
        this.strokePath(g, strip, PaperArt.rgb(bank), 110, geometry.unit * 0.012);
        this.strokePath(g, strip, PaperArt.rgb(light), 60, geometry.unit * 0.005, 0, geometry.unit * 0.014);
      }
    }
  },

  paintDetails(g, geometry, palette, style, w, h) {
    const [main, accent] = palette.detail.map(PaperArt.rgb);
    for (const detail of geometry.layout.details) {
      const x = detail.x * w;
      const y = detail.y * h;
      if (this.distanceToFeature(geometry, x, y) < 6) continue;
      const s = geometry.unit * 0.008 * detail.size;
      g.push();
      g.translate(x, y);
      g.noStroke();
      if (style === 'meadow') {
        if (detail.variant < 2) {
          g.fill(...main, 190);
          g.triangle(-s, 0, -s * 0.4, -s * 2.4, 0, 0);
          g.triangle(-s * 0.3, 0, s * 0.2, -s * 3, s * 0.7, 0);
          g.triangle(s * 0.4, 0, s * 1.3, -s * 2.1, s * 1.4, 0);
        } else {
          g.fill(...accent, 220);
          for (let petal = 0; petal < 4; petal++) g.circle(Math.cos(petal * Math.PI / 2) * s * 0.7, Math.sin(petal * Math.PI / 2) * s * 0.7, s * 0.9);
          g.fill(255, 250, 220, 230);
          g.circle(0, 0, s * 0.7);
        }
      } else if (style === 'snowfield') {
        if (detail.variant === 0) {
          g.fill(...main, 210);
          PaperArt.star(g, 0, 0, s * 1.4, s * 0.35, 4, detail.angle);
        } else {
          g.fill(...accent, 90);
          g.ellipse(s * 0.3, s * 0.4, s * 2.6, s * 1.6);
          g.fill(...main, 200);
          g.ellipse(0, 0, s * 2.4, s * 1.4);
        }
      } else if (style === 'dunes') {
        g.noFill();
        g.rotate(-0.25 + detail.angle * 0.05);
        if (detail.variant < 2) {
          g.stroke(...main, 110); g.strokeWeight(1.4); g.arc(0, 0, s * 9, s * 3, Math.PI * 1.1, Math.PI * 1.9);
          g.stroke(...accent, 90); g.strokeWeight(1); g.arc(0, -2, s * 9, s * 3, Math.PI * 1.15, Math.PI * 1.85);
        } else {
          g.noStroke(); g.fill(...main, 170); g.ellipse(0, 0, s * 1.8, s * 1.2);
        }
      } else if (style === 'ash') {
        if (detail.variant < 2) {
          g.rotate(detail.angle);
          g.noFill(); g.stroke(...main, 70 + detail.size * 40); g.strokeWeight(1.3);
          g.line(0, 0, s * 2, s * 0.8); g.line(s * 2, s * 0.8, s * 3.4, -s * 0.4); g.line(s * 3.4, -s * 0.4, s * 5, s * 0.3);
        } else {
          g.fill(...accent, 160); g.circle(0, 0, s * 1.3);
        }
      } else if (style === 'clouds') {
        if (detail.variant < 2) {
          g.fill(...main, 46); g.circle(0, 0, s * 4); g.circle(s * 2, s * 0.6, s * 3); g.circle(-s * 2, s * 0.8, s * 2.6);
        } else {
          g.fill(...accent, 200); PaperArt.star(g, 0, 0, s * 1.2, s * 0.3, 4, detail.angle);
        }
      } else if (style === 'seabed') {
        if (detail.variant === 0) {
          g.fill(...main, 170);
          PaperArt.capsule(g, 0, 0, s * 0.6, -s * 3, s * 0.7);
          PaperArt.capsule(g, s * 0.5, 0, s * 1.7, -s * 2.2, s * 0.6);
        } else if (detail.variant === 1) {
          g.fill(...accent, 190);
          g.arc(0, 0, s * 2.6, s * 2.6, Math.PI, Math.PI * 2);
          g.fill(255, 240, 245, 120); g.rect(-s * 0.15, -s * 1.2, s * 0.3, s * 1.2);
        } else {
          g.fill(255, 255, 255, 40); g.ellipse(0, 0, s * 2, s * 1.3);
        }
      }
      g.pop();
    }
  },

  paintVignette(g, palette, w, h) {
    const [r, gr, b] = palette.vignette;
    const ctx = g.drawingContext;
    if (ctx && typeof ctx.createRadialGradient === 'function') {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      gradient.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0)`);
      gradient.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0.6)`);
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }
    g.noStroke();
    for (let band = 0; band < 8; band++) {
      g.fill(r, gr, b, 14);
      g.rect(0, 0, w, band * 6);
      g.rect(0, h - band * 6, w, band * 6);
    }
  },

  // Mouvement discret au-dessus du fond : il ne recalcule jamais le tampon.
  drawAnimated(g, id, definition, w, h, now) {
    const geometry = this.geometry(id, definition, w, h);
    const palette = definition.palette;
    const type = definition.backdrop.feature;
    g.push();
    g.noStroke();
    if (geometry.path && type === 'river') {
      const width = geometry.path.width;
      for (let k = 0; k < 14; k++) {
        const point = this.pointAlong(geometry.path, (k / 14 + now * 0.00003 * (1 + (k % 3) * 0.3)) % 1);
        const side = Math.sin(k * 2.3) * width * 0.22;
        g.push();
        g.translate(point.x + point.nx * side, point.y + point.ny * side);
        g.rotate(point.angle);
        g.fill(255, 255, 255, 80 + 60 * Math.sin(now * 0.004 + k));
        g.ellipse(0, 0, width * 0.55, width * 0.1);
        g.pop();
      }
    } else if (geometry.path && type === 'lava-river') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
      this.strokePath(g, geometry.path.points, PaperArt.rgb(palette.feature.light), 40 + pulse * 70, geometry.path.width * 0.55);
      g.noStroke();
      for (let k = 0; k < 7; k++) {
        const cycle = (now * 0.0006 + k * 0.37) % 1;
        const point = this.pointAlong(geometry.path, (k * 0.143 + 0.05) % 1);
        g.fill(255, 220, 140, 200 * (1 - cycle));
        g.circle(point.x + Math.sin(k) * geometry.path.width * 0.2, point.y, 3 + cycle * geometry.path.width * 0.35);
      }
    } else if (geometry.path && type === 'sand-channel') {
      for (let k = 0; k < 7; k++) {
        const x = (0.5 + 0.45 * Math.sin(now * 0.00011 + k * 1.9)) * w;
        const y = (0.5 + 0.45 * Math.cos(now * 0.00009 + k * 2.6)) * h;
        g.fill(160, 255, 240, 9 + (k % 3) * 3);
        g.ellipse(x, y, geometry.unit * 0.42, geometry.unit * 0.24);
      }
    } else if (geometry.lake) {
      const { x, y, radius } = geometry.lake;
      if (definition.backdrop.frozen) {
        for (let k = 0; k < 6; k++) {
          const twinkle = Math.max(0, Math.sin(now * 0.003 + k * 1.7));
          g.fill(255, 255, 255, 230 * twinkle);
          PaperArt.star(g, x + Math.cos(k * 1.1) * radius * 0.6, y + Math.sin(k * 1.9) * radius * 0.5, 5 * twinkle + 1, 1, 4);
        }
      } else {
        g.noFill();
        for (let k = 0; k < 2; k++) {
          const cycle = (now * 0.00035 + k * 0.5) % 1;
          g.stroke(255, 255, 255, 120 * (1 - cycle));
          g.strokeWeight(1.5);
          g.ellipse(x - radius * 0.1, y, radius * 0.4 + cycle * radius * 1.1, (radius * 0.4 + cycle * radius * 1.1) * 0.6);
        }
      }
    } else if (geometry.strips) {
      g.noFill();
      g.strokeWeight(geometry.unit * 0.006);
      geometry.strips.forEach((strip, index) => {
        const start = Math.floor(((now * 0.006 + index * 9) % (strip.length + 8))) - 8;
        g.stroke(255, 255, 255, 150);
        g.beginShape();
        for (let k = Math.max(0, start); k < Math.min(strip.length, start + 6); k++) g.vertex(strip[k].x, strip[k].y);
        g.endShape();
      });
    }
    g.pop();
  },
};
