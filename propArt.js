// Décors en figurines de papier découpé : obstacles et cachettes de chaque lieu.
// (0, 0) est le centre de l'empreinte au sol ; la figurine se dresse vers le haut.
// Les figurines ne servent qu'à l'affichage : la collision reste le cercle de rayon r.
//
// Chaque type peut définir :
//   draw(g, r, now)  la figurine ; peinte une seule fois dans un sprite si possible,
//   under(g, r, now) un effet animé sous la figurine (halo),
//   fx(g, r, now)    un effet animé au-dessus (lueur, fumée, drapeau),
//   bob(r, now)      un décalage vertical (figurine qui flotte),
//   live: true       la figurine entière est animée et redessinée à chaque image.
const PropArt = {
  sprites: {},
  MAX_SPRITES: 80,

  has(kind) {
    return Boolean(PropArt.KINDS[kind]);
  },

  draw(g, kind, x, y, r, now = 0) {
    const spec = PropArt.KINDS[kind] ?? PropArt.KINDS['mossy-rock'];
    g.push();
    g.translate(x, y);
    PaperArt.groundShadow(g, r * 0.12, r * 0.38, r * (spec.bob ? 1.4 : 2.2), r * (spec.bob ? 0.45 : 0.75));
    if (spec.under) spec.under(g, r, now);
    if (spec.bob) g.translate(0, spec.bob(r, now));
    const sprite = spec.live ? null : PropArt.sprite(kind, spec, r);
    if (sprite) g.image(sprite.buffer, -sprite.ox, -sprite.oy, sprite.w, sprite.h);
    else spec.draw(g, r, now);
    if (spec.fx) spec.fx(g, r, now);
    g.pop();
  },

  // Sprite hors écran d'une figurine statique, réutilisé à chaque image.
  sprite(kind, spec, r) {
    if (typeof createGraphics !== 'function') return null;
    const radius = Math.round(r * 2) / 2;
    const key = `${kind}:${radius}`;
    if (PropArt.sprites[key]) return PropArt.sprites[key];
    if (Object.keys(PropArt.sprites).length >= PropArt.MAX_SPRITES) PropArt.clearSprites();
    const w = Math.ceil(radius * 4.4);
    const h = Math.ceil(radius * 5.2);
    const ox = w / 2;
    const oy = Math.ceil(radius * 3.3);
    const buffer = createGraphics(w, h);
    buffer.translate(ox, oy);
    spec.draw(buffer, radius, 0);
    PropArt.sprites[key] = { buffer, w, h, ox, oy };
    return PropArt.sprites[key];
  },

  clearSprites() {
    for (const sprite of Object.values(PropArt.sprites)) sprite.buffer.remove?.();
    PropArt.sprites = {};
  },

  figure(g, silhouette, paint) {
    PaperArt.standee(g, silhouette, paint, { border: 2.2 });
  },

  rock(g, r) {
    g.beginShape();
    g.vertex(-r, r * 0.35); g.vertex(-r * 0.85, -r * 0.3); g.vertex(-r * 0.35, -r * 0.85);
    g.vertex(r * 0.4, -r * 0.8); g.vertex(r * 0.95, -r * 0.15); g.vertex(r * 0.85, r * 0.35);
    g.endShape(CLOSE);
  },

  rockFacet(g, r) {
    g.beginShape();
    g.vertex(-r * 0.85, -r * 0.3); g.vertex(-r * 0.35, -r * 0.85); g.vertex(r * 0.4, -r * 0.8);
    g.vertex(r * 0.1, -r * 0.2); g.vertex(-r * 0.6, r * 0.05);
    g.endShape(CLOSE);
  },

  pulse(now, speed, offset = 0) {
    return 0.5 + 0.5 * Math.sin(now * speed + offset);
  },

  KINDS: {
    // ----- Forêt de l'Émeraude
    'round-tree': { draw(g, r) {
      const shape = s => {
        s.rect(-r * 0.18, -r * 0.4, r * 0.36, r * 0.8, 3);
        s.circle(0, -r * 0.95, r * 1.9); s.circle(-r * 0.6, -r * 0.55, r * 1.2); s.circle(r * 0.6, -r * 0.6, r * 1.25);
      };
      PropArt.figure(g, shape, s => {
        s.fill('#6b4a33'); s.rect(-r * 0.18, -r * 0.4, r * 0.36, r * 0.8, 3);
        s.fill('#2f6b3f'); s.circle(0, -r * 0.95, r * 1.9); s.circle(-r * 0.6, -r * 0.55, r * 1.2); s.circle(r * 0.6, -r * 0.6, r * 1.25);
        s.fill('#3f8a4c'); s.circle(-r * 0.12, -r * 1.05, r * 1.35); s.circle(-r * 0.62, -r * 0.65, r * 0.75);
        s.fill('#62a85e'); s.circle(-r * 0.32, -r * 1.25, r * 0.7);
        s.fill('#f4d35e'); s.circle(r * 0.35, -r * 0.7, r * 0.18); s.circle(-r * 0.2, -r * 0.55, r * 0.14); s.circle(r * 0.15, -r * 1.35, r * 0.13);
      });
    } },
    'mossy-rock': { draw(g, r) {
      PropArt.figure(g, s => PropArt.rock(s, r), s => {
        s.fill('#66705f'); PropArt.rock(s, r);
        s.fill('#838e78'); PropArt.rockFacet(s, r);
        s.fill('#5f9a4e'); s.ellipse(-r * 0.15, -r * 0.72, r * 1.05, r * 0.38); s.ellipse(r * 0.45, -r * 0.55, r * 0.5, r * 0.22);
        s.fill('#8cc47a'); s.ellipse(-r * 0.3, -r * 0.8, r * 0.45, r * 0.14);
      });
    } },
    mushroom: {
      under(g, r, now) {
        g.noStroke(); g.fill(95, 212, 196, 30 + PropArt.pulse(now, 0.003) * 30); g.circle(0, -r * 0.6, r * 3.1);
      },
      draw(g, r) {
        const shape = s => { s.rect(-r * 0.25, -r * 0.6, r * 0.5, r * 0.95, r * 0.2); s.arc(0, -r * 0.5, r * 2.1, r * 1.8, Math.PI, Math.PI * 2); };
        PropArt.figure(g, shape, s => {
          s.fill('#efe3c8'); s.rect(-r * 0.25, -r * 0.6, r * 0.5, r * 0.95, r * 0.2);
          s.fill('#2f9c90'); s.arc(0, -r * 0.5, r * 2.1, r * 1.8, Math.PI, Math.PI * 2);
          s.fill('#5fd4c4'); s.arc(-r * 0.08, -r * 0.55, r * 1.6, r * 1.45, Math.PI, Math.PI * 2);
          s.fill('#fdf6e3'); s.circle(-r * 0.45, -r * 0.85, r * 0.3); s.circle(r * 0.2, -r * 1.1, r * 0.26); s.circle(r * 0.6, -r * 0.7, r * 0.2);
        });
      },
    },
    stump: { draw(g, r) {
      const shape = s => { s.rect(-r * 0.75, -r * 0.45, r * 1.5, r * 0.8, 4); s.ellipse(0, -r * 0.45, r * 1.5, r * 0.62); };
      PropArt.figure(g, shape, s => {
        s.fill('#7a5235'); s.rect(-r * 0.75, -r * 0.45, r * 1.5, r * 0.8, 4);
        s.fill('#5e3f29'); s.rect(r * 0.35, -r * 0.45, r * 0.4, r * 0.8, 3);
        s.fill('#c79a64'); s.ellipse(0, -r * 0.45, r * 1.5, r * 0.62);
        s.noFill(); s.stroke('#9c7046'); s.strokeWeight(1.2); s.ellipse(0, -r * 0.45, r * 1.0, r * 0.4); s.ellipse(0, -r * 0.45, r * 0.5, r * 0.2);
        s.noStroke(); s.fill('#5f9a4e'); s.ellipse(-r * 0.55, -r * 0.05, r * 0.5, r * 0.25);
      });
    } },
    'fern-bush': { draw(g, r) {
      const puffs = [[0, -0.35, 1.3], [-0.6, -0.1, 1.0], [0.6, -0.1, 1.0], [-0.3, -0.75, 0.9], [0.35, -0.7, 0.9]];
      const shape = s => { for (const [x, y, d] of puffs) s.circle(x * r, y * r, d * r); };
      PropArt.figure(g, shape, s => {
        s.fill('#2d6a3a'); for (const [x, y, d] of puffs) s.circle(x * r, y * r, d * r);
        s.fill('#3e8a48'); for (const [x, y, d] of puffs) s.circle(x * r - r * 0.06, y * r - r * 0.08, d * r * 0.7);
        s.fill('#62a85e'); s.circle(-r * 0.35, -r * 0.85, r * 0.35); s.circle(r * 0.25, -r * 0.6, r * 0.3);
        s.fill('#e9d36c'); s.circle(-r * 0.5, -r * 0.2, r * 0.12); s.circle(r * 0.5, -r * 0.35, r * 0.12); s.circle(0, -r * 0.55, r * 0.1);
      });
    } },

    // ----- Montagne de Glace
    'snow-pine': { draw(g, r) {
      const tiers = [[-0.1, 1.0, 1.0], [-0.6, 0.8, 0.9], [-1.05, 0.55, 0.85]];
      const shape = s => {
        s.rect(-r * 0.14, -r * 0.2, r * 0.28, r * 0.55, 2);
        for (const [y, half, tall] of tiers) s.triangle(-r * half, r * y, r * half, r * y, 0, r * (y - tall));
      };
      PropArt.figure(g, shape, s => {
        s.fill('#5a4030'); s.rect(-r * 0.14, -r * 0.2, r * 0.28, r * 0.55, 2);
        for (const [y, half, tall] of tiers) {
          s.fill('#2f5a4a'); s.triangle(-r * half, r * y, r * half, r * y, 0, r * (y - tall));
          s.fill('#3d7360'); s.triangle(-r * half, r * y, 0, r * y, 0, r * (y - tall));
          s.fill('#ffffff');
          const top = r * (y - tall);
          s.beginShape();
          s.vertex(0, top); s.vertex(r * half * 0.5, top + r * tall * 0.5); s.vertex(r * half * 0.2, top + r * tall * 0.42);
          s.vertex(0, top + r * tall * 0.55); s.vertex(-r * half * 0.25, top + r * tall * 0.42); s.vertex(-r * half * 0.5, top + r * tall * 0.5);
          s.endShape(CLOSE);
        }
      });
    } },
    'ice-crystal': {
      under(g, r, now) {
        g.noStroke(); g.fill(127, 209, 255, 26 + PropArt.pulse(now, 0.0025) * 26); g.circle(0, -r * 0.5, r * 3);
      },
      draw(g, r) {
        const shards = [[-0.45, 0.5, 1.2, -0.25], [0.1, 0.6, 1.7, 0.05], [0.55, 0.45, 1.1, 0.3]];
        const shard = (s, [cx, w, h, tilt], inset = 0) => {
          s.push(); s.translate(cx * r, r * 0.3); s.rotate(tilt);
          const hw = (w * r) / 2 - inset;
          s.beginShape(); s.vertex(-hw, 0); s.vertex(-hw, -h * r * 0.75); s.vertex(0, -h * r + inset); s.vertex(hw, -h * r * 0.75); s.vertex(hw, 0); s.endShape(CLOSE);
          s.pop();
        };
        PropArt.figure(g, s => shards.forEach(item => shard(s, item)), s => {
          for (const item of shards) {
            s.fill('#6fb2dc'); shard(s, item);
            s.fill('#a9dcf6'); shard(s, [item[0] - 0.06, item[1] * 0.55, item[2] * 0.95, item[3]]);
            s.fill('#e6f6ff'); shard(s, [item[0] - 0.09, item[1] * 0.2, item[2] * 0.75, item[3]]);
          }
        });
      },
    },
    'snow-rock': { draw(g, r) {
      PropArt.figure(g, s => PropArt.rock(s, r), s => {
        s.fill('#6f7f99'); PropArt.rock(s, r);
        s.fill('#8a9ab3'); PropArt.rockFacet(s, r);
        s.fill('#ffffff');
        s.beginShape(); s.vertex(-r * 0.85, -r * 0.3); s.vertex(-r * 0.35, -r * 0.85); s.vertex(r * 0.4, -r * 0.8); s.vertex(r * 0.95, -r * 0.15);
        s.vertex(r * 0.5, -r * 0.35); s.vertex(r * 0.15, -r * 0.25); s.vertex(-r * 0.3, -r * 0.4); s.endShape(CLOSE);
      });
    } },
    igloo: { draw(g, r) {
      const shape = s => s.arc(0, r * 0.3, r * 2.3, r * 2.3, Math.PI, Math.PI * 2);
      PropArt.figure(g, shape, s => {
        s.fill('#f4f8fc'); s.arc(0, r * 0.3, r * 2.3, r * 2.3, Math.PI, Math.PI * 2);
        s.fill('#dce8f4'); s.arc(r * 0.2, r * 0.3, r * 1.9, r * 2.1, Math.PI * 1.5, Math.PI * 2);
        s.noFill(); s.stroke('#b9cde2'); s.strokeWeight(1.3);
        s.arc(0, r * 0.3, r * 1.6, r * 1.45, Math.PI, Math.PI * 2); s.arc(0, r * 0.3, r * 0.9, r * 0.7, Math.PI, Math.PI * 2);
        for (const x of [-0.75, -0.25, 0.25, 0.75]) s.line(x * r, r * 0.3 - r * 0.32, x * r * 1.05, r * 0.3 - r * 0.62);
        s.noStroke(); s.fill('#2a3a55'); s.arc(0, r * 0.32, r * 0.75, r * 0.95, Math.PI, Math.PI * 2);
      });
    } },

    // ----- Désert d'Or
    cactus: { draw(g, r) {
      const limbs = [[0, 0.3, 0, -1.4, 0.55], [-0.15, -0.35, -0.7, -0.35, 0.36], [-0.7, -0.35, -0.7, -0.95, 0.36], [0.15, -0.65, 0.65, -0.65, 0.32], [0.65, -0.65, 0.65, -1.15, 0.32]];
      const shape = s => { for (const [x1, y1, x2, y2, t] of limbs) PaperArt.capsule(s, x1 * r, y1 * r, x2 * r, y2 * r, t * r); };
      PropArt.figure(g, shape, s => {
        s.fill('#3f8a4f'); shape(s);
        s.fill('#5aa866'); PaperArt.capsule(s, -r * 0.08, r * 0.2, -r * 0.08, -r * 1.35, r * 0.16);
        s.fill('#ff7b9c'); PaperArt.star(s, 0, -r * 1.68, r * 0.22, r * 0.1, 5);
        s.fill('#ffe28a'); s.circle(0, -r * 1.68, r * 0.1);
      });
    } },
    'mesa-rock': { draw(g, r) {
      const outline = s => {
        s.beginShape(); s.vertex(-r, r * 0.35); s.vertex(-r * 0.9, -r * 0.5); s.vertex(-r * 0.6, -r * 0.95);
        s.vertex(r * 0.65, -r * 0.95); s.vertex(r * 0.95, -r * 0.4); s.vertex(r, r * 0.35); s.endShape(CLOSE);
      };
      PropArt.figure(g, outline, s => {
        s.fill('#b5653a'); outline(s);
        s.fill('#cf7c47'); s.quad(-r * 0.92, -r * 0.35, r * 0.93, -r * 0.35, r * 0.97, -r * 0.12, -r * 0.94, -r * 0.12);
        s.fill('#9a4f2b'); s.quad(-r * 0.96, r * 0.05, r * 0.98, r * 0.05, r * 0.99, r * 0.18, -r * 0.97, r * 0.18);
        s.fill('#e8a96c'); s.quad(-r * 0.6, -r * 0.95, r * 0.65, -r * 0.95, r * 0.8, -r * 0.68, -r * 0.78, -r * 0.68);
      });
    } },
    urn: { draw(g, r) {
      const shape = s => {
        s.ellipse(0, -r * 0.35, r * 1.4, r * 1.5); s.rect(-r * 0.3, -r * 1.25, r * 0.6, r * 0.5);
        s.rect(-r * 0.45, -r * 1.38, r * 0.9, r * 0.22, 3);
        PaperArt.capsule(s, -r * 0.35, -r * 1.05, -r * 0.8, -r * 0.6, r * 0.14); PaperArt.capsule(s, r * 0.35, -r * 1.05, r * 0.8, -r * 0.6, r * 0.14);
      };
      PropArt.figure(g, shape, s => {
        s.fill('#c86b3c'); shape(s);
        s.fill('#a5532b'); s.arc(0, -r * 0.35, r * 1.4, r * 1.5, -Math.PI / 2, Math.PI / 2);
        s.fill('#f6dca8'); s.rect(-r * 0.68, -r * 0.5, r * 1.36, r * 0.3);
        s.fill('#41230f'); for (let i = 0; i < 5; i++) s.triangle(-r * 0.6 + i * r * 0.27, -r * 0.22, -r * 0.47 + i * r * 0.27, -r * 0.48, -r * 0.34 + i * r * 0.27, -r * 0.22);
        s.fill('#e89a6a'); s.ellipse(-r * 0.32, -r * 0.75, r * 0.2, r * 0.45);
      });
    } },
    tent: {
      draw(g, r) {
        const shape = s => s.triangle(-r * 1.1, r * 0.3, r * 1.1, r * 0.3, 0, -r * 1.2);
        PropArt.figure(g, shape, s => {
          s.fill('#f6dca8'); shape(s);
          s.fill('#ff7b54'); s.triangle(-r * 1.1, r * 0.3, -r * 0.55, r * 0.3, 0, -r * 1.2); s.triangle(r * 0.2, r * 0.3, r * 0.75, r * 0.3, 0, -r * 1.2);
          s.fill('#41230f'); s.triangle(-r * 0.32, r * 0.3, r * 0.32, r * 0.3, 0, -r * 0.35);
          s.fill('#7a3b20'); s.rect(-r * 0.03, -r * 1.55, r * 0.06, r * 0.4);
        });
      },
      fx(g, r, now) {
        const wave = Math.sin(now * 0.006) * r * 0.08;
        g.noStroke(); g.fill('#ff7b54'); g.triangle(r * 0.03, -r * 1.55, r * 0.03, -r * 1.35, r * 0.42, -r * 1.45 + wave);
      },
    },

    // ----- Île Volcanique
    basalt: {
      draw(g, r) {
        const columns = [[-0.55, 0.45, 1.1], [0, 0.5, 1.55], [0.52, 0.42, 0.9]];
        const shape = s => {
          for (const [x, w, h] of columns) {
            s.rect((x - w / 2) * r, -h * r, w * r, h * r + r * 0.35);
            s.ellipse(x * r, -h * r, w * r, w * r * 0.45);
          }
        };
        PropArt.figure(g, shape, s => {
          for (const [x, w, h] of columns) {
            s.fill('#6a5560'); s.rect((x - w / 2) * r, -h * r, w * r, h * r + r * 0.35);
            s.fill('#4e3e47'); s.rect(x * r, -h * r, w * r / 2, h * r + r * 0.35);
            s.fill('#8f7681'); s.ellipse(x * r, -h * r, w * r, w * r * 0.45);
          }
        });
      },
      fx(g, r, now) {
        g.noFill(); g.stroke(255, 122, 47, 160 + PropArt.pulse(now, 0.004) * 90); g.strokeWeight(1.6);
        g.line(-r * 0.5, -r * 0.6, -r * 0.62, -r * 0.2); g.line(-r * 0.62, -r * 0.2, -r * 0.5, r * 0.1);
        g.line(r * 0.05, -r * 1.2, -r * 0.05, -r * 0.7); g.line(r * 0.55, -r * 0.5, r * 0.62, -r * 0.1);
      },
    },
    'lava-vent': {
      draw(g, r) {
        const cone = s => {
          s.beginShape(); s.vertex(-r, r * 0.35); s.vertex(-r * 0.32, -r * 0.8); s.vertex(r * 0.32, -r * 0.8); s.vertex(r, r * 0.35); s.endShape(CLOSE);
        };
        PropArt.figure(g, cone, s => {
          s.fill('#7a4a4f'); cone(s);
          s.fill('#5c3539'); s.quad(0, -r * 0.8, r * 0.32, -r * 0.8, r, r * 0.35, r * 0.2, r * 0.35);
          s.fill('#ff7a2f'); s.ellipse(0, -r * 0.8, r * 0.7, r * 0.26);
          s.fill('#ff5a1f'); PaperArt.capsule(s, -r * 0.12, -r * 0.75, -r * 0.3, -r * 0.2, r * 0.13);
        });
      },
      fx(g, r, now) {
        g.noStroke();
        g.fill(255, 211, 110, 180 + PropArt.pulse(now, 0.005) * 75); g.ellipse(0, -r * 0.8, r * 0.4, r * 0.13);
        for (let k = 0; k < 3; k++) {
          const cycle = (now * 0.0004 + k / 3) % 1;
          g.fill(90, 70, 78, 110 * (1 - cycle));
          g.circle(Math.sin(cycle * 6 + k) * r * 0.25, -r * 0.95 - cycle * r * 1.6, r * (0.35 + cycle * 0.6));
        }
      },
    },
    'dead-tree': {
      draw(g, r) {
        const limbs = [[0, 0.3, 0, -0.9, 0.32], [0, -0.45, -0.7, -1.1, 0.18], [0, -0.7, 0.65, -1.35, 0.16], [-0.45, -0.85, -0.5, -1.45, 0.12], [0.35, -1.0, 0.85, -1.05, 0.1]];
        const shape = s => { for (const [x1, y1, x2, y2, t] of limbs) PaperArt.capsule(s, x1 * r, y1 * r, x2 * r, y2 * r, t * r); };
        PropArt.figure(g, shape, s => {
          s.fill('#5e434b'); shape(s);
          s.fill('#7e5f68'); PaperArt.capsule(s, -r * 0.06, r * 0.25, -r * 0.06, -r * 0.85, r * 0.1);
        });
      },
      fx(g, r, now) {
        g.noStroke(); g.fill(255, 122, 47, 150 + PropArt.pulse(now, 0.006) * 100);
        g.circle(r * 0.04, -r * 0.2, r * 0.13); g.circle(-r * 0.3, -r * 0.78, r * 0.1);
      },
    },
    cave: {
      draw(g, r) {
        const shape = s => { s.arc(0, r * 0.3, r * 2.4, r * 2.1, Math.PI, Math.PI * 2); s.circle(-r * 0.9, r * 0.05, r * 0.8); s.circle(r * 0.95, r * 0.08, r * 0.7); };
        PropArt.figure(g, shape, s => {
          s.fill('#7a4f56'); shape(s);
          s.fill('#946269'); s.arc(-r * 0.15, r * 0.3, r * 1.9, r * 1.8, Math.PI, Math.PI * 1.7);
          s.fill('#0f0809'); s.arc(0, r * 0.32, r * 1.15, r * 1.3, Math.PI, Math.PI * 2);
        });
      },
      fx(g, r, now) {
        g.noStroke(); g.fill(255, 138, 61, 70 + PropArt.pulse(now, 0.004) * 80); g.ellipse(0, r * 0.2, r * 0.7, r * 0.25);
      },
    },

    // ----- Cité des Nuages
    'cloud-bank': { draw(g, r) {
      const puffs = [[-0.6, -0.2, 1.2], [0, -0.55, 1.5], [0.65, -0.25, 1.15]];
      const shape = s => { for (const [x, y, d] of puffs) s.circle(x * r, y * r, d * r); s.rect(-r * 1.1, -r * 0.25, r * 2.2, r * 0.6, r * 0.3); };
      PropArt.figure(g, shape, s => {
        s.fill('#d7e2f8'); shape(s);
        s.fill('#ffffff'); for (const [x, y, d] of puffs) s.circle(x * r - r * 0.06, y * r - r * 0.1, d * r * 0.78);
      });
    } },
    'sky-tower': {
      draw(g, r) {
        const shape = s => { s.rect(-r * 0.45, -r * 1.2, r * 0.9, r * 1.55, 3); s.triangle(-r * 0.62, -r * 1.2, r * 0.62, -r * 1.2, 0, -r * 2.0); };
        PropArt.figure(g, shape, s => {
          s.fill('#f1e6d2'); s.rect(-r * 0.45, -r * 1.2, r * 0.9, r * 1.55, 3);
          s.fill('#d8c9b0'); s.rect(r * 0.1, -r * 1.2, r * 0.35, r * 1.55, 2);
          s.fill('#5868c8'); s.triangle(-r * 0.62, -r * 1.2, r * 0.62, -r * 1.2, 0, -r * 2.0);
          s.fill('#7484e0'); s.triangle(-r * 0.62, -r * 1.2, 0, -r * 1.2, 0, -r * 2.0);
          s.fill('#ffd166'); s.arc(0, -r * 0.55, r * 0.36, r * 0.5, Math.PI, Math.PI * 2); s.rect(-r * 0.18, -r * 0.55, r * 0.36, r * 0.3);
          s.fill('#26336a'); s.rect(-r * 0.02, -r * 2.35, r * 0.04, r * 0.38);
        });
        g.noStroke(); g.fill(255, 255, 255, 220); g.circle(-r * 0.5, r * 0.3, r * 0.6); g.circle(r * 0.45, r * 0.32, r * 0.55); g.circle(0, r * 0.38, r * 0.6);
      },
      fx(g, r, now) {
        const wave = Math.sin(now * 0.007) * r * 0.07;
        g.noStroke(); g.fill('#ff7b54'); g.triangle(r * 0.02, -r * 2.35, r * 0.02, -r * 2.15, r * 0.38, -r * 2.25 + wave);
      },
    },
    'floating-rock': {
      bob(r, now) { return -r * 0.55 + Math.sin(now * 0.002 + r) * r * 0.08; },
      draw(g, r) {
        const shape = s => {
          s.beginShape(); s.vertex(-r, -r * 0.4); s.vertex(r, -r * 0.4); s.vertex(r * 0.45, r * 0.4); s.vertex(0, r * 0.8); s.vertex(-r * 0.5, r * 0.35); s.endShape(CLOSE);
          s.ellipse(0, -r * 0.42, r * 2.05, r * 0.6);
        };
        PropArt.figure(g, shape, s => {
          s.fill('#8a7a8f'); shape(s);
          s.fill('#6e5f73'); s.triangle(0, -r * 0.4, r, -r * 0.4, 0, r * 0.8);
          s.fill('#8fd17a'); s.ellipse(0, -r * 0.42, r * 2.05, r * 0.6);
          s.fill('#b4e59c'); s.ellipse(-r * 0.25, -r * 0.48, r * 1.1, r * 0.3);
          s.fill('#ffd166'); s.circle(r * 0.4, -r * 0.5, r * 0.14);
        });
      },
    },
    'cloud-nest': { draw(g, r) {
      const shape = s => { s.ellipse(0, -r * 0.1, r * 2.4, r * 1.3); s.circle(-r * 0.8, -r * 0.35, r * 0.9); s.circle(r * 0.8, -r * 0.35, r * 0.9); };
      PropArt.figure(g, shape, s => {
        s.fill('#ffffff'); shape(s);
        s.fill('#a77b52'); s.ellipse(0, -r * 0.2, r * 1.7, r * 0.75);
        s.fill('#fff3d6'); s.ellipse(0, -r * 0.24, r * 1.25, r * 0.48);
        s.fill('#e4ecfb'); s.circle(-r * 0.55, r * 0.1, r * 0.6); s.circle(r * 0.5, r * 0.12, r * 0.55);
      });
    } },

    // ----- Océan Profond
    coral: { draw(g, r) {
      const limbs = [[0, 0.3, 0, -1.2, 0.32], [0, -0.2, -0.75, -0.95, 0.26], [0, -0.35, 0.8, -1.0, 0.26], [-0.5, -0.65, -0.95, -0.4, 0.2], [0.5, -0.7, 0.55, -1.45, 0.2]];
      const shape = s => { for (const [x1, y1, x2, y2, t] of limbs) PaperArt.capsule(s, x1 * r, y1 * r, x2 * r, y2 * r, t * r); };
      PropArt.figure(g, shape, s => {
        s.fill('#e0567a'); shape(s);
        s.fill('#ffb3c4'); for (const [, , x2, y2, t] of limbs) s.circle(x2 * r, y2 * r, t * r * 1.1);
        s.fill('#ff8fab'); PaperArt.capsule(s, -r * 0.06, r * 0.2, -r * 0.06, -r * 1.1, r * 0.12);
      });
    } },
    kelp: { live: true, draw(g, r, now) {
      const strands = [-0.45, 0.05, 0.5];
      const segments = (s, index, base, thickness) => {
        let x = base * r;
        let y = r * 0.3;
        for (let k = 0; k < 4; k++) {
          const angle = -Math.PI / 2 + Math.sin(now * 0.0018 + index * 1.3 + k * 0.7) * 0.25;
          const nx = x + Math.cos(angle) * r * 0.48;
          const ny = y + Math.sin(angle) * r * 0.48;
          PaperArt.capsule(s, x, y, nx, ny, thickness * r);
          x = nx; y = ny;
        }
      };
      PropArt.figure(g, s => strands.forEach((base, i) => segments(s, i, base, 0.24)), s => {
        s.fill('#2f8f5f'); strands.forEach((base, i) => segments(s, i, base, 0.24));
        s.fill('#58c08a'); strands.forEach((base, i) => segments(s, i, base, 0.08));
      });
    } },
    'clam-rock': {
      draw(g, r) {
        PropArt.figure(g, s => { PropArt.rock(s, r); }, s => {
          s.fill('#2f4f66'); PropArt.rock(s, r);
          s.fill('#3f6580'); PropArt.rockFacet(s, r);
          s.fill('#c9b6e0'); s.arc(r * 0.05, -r * 0.55, r * 1.2, r * 0.7, 0, Math.PI);
          s.fill('#e6d8f5'); s.arc(r * 0.05, -r * 0.6, r * 1.2, r * 0.9, Math.PI * 1.05, Math.PI * 1.95);
        });
      },
      fx(g, r, now) {
        g.noStroke();
        g.fill(255, 244, 214, 60 + PropArt.pulse(now, 0.003) * 60); g.circle(r * 0.05, -r * 0.5, r * 0.75);
        g.fill('#fff4d6'); g.circle(r * 0.05, -r * 0.5, r * 0.32);
      },
    },
    anemone: { draw(g, r, now = 0) {
      const tentacles = [];
      for (let i = 0; i < 9; i++) {
        const angle = Math.PI + Math.PI * (i + 0.5) / 9 + Math.sin(now * 0.002 + i) * 0.08;
        tentacles.push([Math.cos(angle) * r * 0.3, -r * 0.1, Math.cos(angle) * r * 1.1, -r * 0.1 + Math.sin(angle) * r * 1.0]);
      }
      const shape = s => {
        s.ellipse(0, r * 0.05, r * 1.6, r * 0.7);
        for (const [x1, y1, x2, y2] of tentacles) PaperArt.capsule(s, x1, y1, x2, y2, r * 0.2);
      };
      PropArt.figure(g, shape, s => {
        s.fill('#b45fc8'); for (const [x1, y1, x2, y2] of tentacles) PaperArt.capsule(s, x1, y1, x2, y2, r * 0.2);
        s.fill('#ffd0f0'); for (const [, , x2, y2] of tentacles) s.circle(x2, y2, r * 0.2);
        s.fill('#7a3f8a'); s.ellipse(0, r * 0.05, r * 1.6, r * 0.7);
        s.fill('#e79ad8'); s.ellipse(0, -r * 0.05, r * 0.7, r * 0.25);
      });
    } },
  },
};
