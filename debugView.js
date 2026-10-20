// Vue debug : lecture des perceptions, vitesses et poids du réseau, sans recalcul de force.

// Debug : lecture des données de perception et des vitesses, sans recalcul de force.
// Chaque trait a un liseré sombre pour rester lisible sur les fonds clairs (glace, nuages).
function drawSteeringDebug() {
  const g = drawingTarget();
  const now = millis();
  const inkedLine = (x1, y1, x2, y2, color, weight) => {
    stroke(20, 14, 26, 150); strokeWeight(weight + 2.2); line(x1, y1, x2, y2);
    stroke(color); strokeWeight(weight); line(x1, y1, x2, y2);
  };
  push();
  noFill();
  if (patrolPath.length > 1) {
    stroke(255, 255, 255, 110); strokeWeight(1.5);
    for (let index = 0; index < patrolPath.length; index++) {
      const start = patrolPath[index];
      const end = patrolPath[(index + 1) % patrolPath.length];
      const steps = Math.max(1, Math.floor(p5.Vector.dist(start, end) / 14));
      for (let step = 0; step < steps; step += 2) {
        const a = p5.Vector.lerp(start, end, step / steps);
        const b = p5.Vector.lerp(start, end, Math.min(1, (step + 1) / steps));
        line(a.x, a.y, b.x, b.y);
      }
    }
  }
  for (const target of targets) {
    if (!target.playerControlled) {
      // rayon de déclenchement (blanc, rouge s'il est franchi) et distance de sécurité (vert)
      const detected = target.escape.threatDistance <= target.detectionRadius;
      stroke(detected ? 'rgba(255, 107, 107, 0.75)' : 'rgba(255, 255, 255, 0.3)'); strokeWeight(1);
      PaperArt.dashedCircle(g, target.pos.x, target.pos.y, target.detectionRadius * 2, 28, 0, 0.4);
      stroke(123, 228, 149, target.escape.state === 'normal' ? 60 : 160); strokeWeight(1);
      PaperArt.dashedCircle(g, target.pos.x, target.pos.y, target.exitDistance * 2, 32, 0, 0.3);
      if (target.escape.state !== 'normal' && target.nearest) {
        inkedLine(target.pos.x, target.pos.y, target.nearest.ship.pos.x, target.nearest.ship.pos.y, 'rgba(255, 107, 107, 0.7)', 1);
      }
    }
    if (target.vel.magSq() > 0.001) {
      inkedLine(target.pos.x, target.pos.y, target.pos.x + target.vel.x * 9, target.pos.y + target.vel.y * 9, '#ffd166', 1.6);
    }
    if (target instanceof NeuralSpirit) {
      drawBrainDebug(target);
      // capteurs à rayons pendant la fuite : vert libre, rouge si un danger est touché
      if (target.mode === 'flee') for (const sensor of target.sensors) sensor.show();
    }
  }
  for (const vehicle of vehicles) {
    if (vehicle.vel.magSq() < 0.001) continue;
    const heading = vehicle.vel.copy().normalize();
    inkedLine(vehicle.pos.x, vehicle.pos.y, vehicle.pos.x + heading.x * 60, vehicle.pos.y + heading.y * 60, '#7fe7ff', 1.4);
  }
  for (const obstacle of obstacles) {
    stroke(255, 120, 120, 190); strokeWeight(1.4);
    PaperArt.dashedCircle(g, obstacle.pos.x, obstacle.pos.y, (obstacle.r + 12) * 2, 20, now * 0.0005);
  }
  pop();
}

// Poids choisis par le réseau pendant la fuite (déjà calculés par decide) :
// rouge = évitement, bleu = séparation, jaune = vers la luciole, vert = vers le refuge,
// violet = se cacher derrière un obstacle.
const BRAIN_DEBUG_COLORS = { evade: '#ff6b6b', separate: '#7fb2ff', toPlayer: '#ffd166', toRefuge: '#7be495', toHide: '#c9a0ff' };

function drawBrainDebug(spirit) {
  const names = SPIRIT_BRAIN.outputs;
  if (names.every(name => spirit.brainWeights[name] === 0)) return;
  const barWidth = 5;
  const maxHeight = 22;
  const x0 = spirit.pos.x - names.length * (barWidth + 2) / 2;
  const y0 = spirit.pos.y - spirit.r - 14;
  push();
  noStroke();
  fill(20, 14, 26, 150);
  rect(x0 - 3, y0 - maxHeight - 3, names.length * (barWidth + 2) + 4, maxHeight + 6, 3);
  names.forEach((name, index) => {
    const h = maxHeight * spirit.brainWeights[name] / SPIRIT_BRAIN.scale[name];
    fill(BRAIN_DEBUG_COLORS[name]);
    rect(x0 + index * (barWidth + 2), y0 - h, barWidth, h);
  });
  pop();
}
