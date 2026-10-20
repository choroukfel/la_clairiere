// Effets (rendu) : traînée de la luciole, anneaux, confettis, messages, halos et son de mouvement.

function updateMotionSound() {
  const controlledTarget = targets.find(target => target.playerControlled);
  const speed = controlledTarget?.vel.mag() ?? 0;
  const active = gameState === 'playing' && soundEnabled && speed > 0.08;
  if (active !== soundWasActive) {
    motionTone.amp(active ? 0.07 * soundVolume : 0, 0.12);
    soundWasActive = active;
  }
  if (active) motionTone.freq(280 + Math.min(720, speed * 130));
}

function updatePlayerTrail(now) {
  const player = targets.find(target => target.playerControlled);
  if (player && player.vel.magSq() > 0.025 && now - lastTrailSampleAt > 27) {
    playerTrail.push({ x: player.pos.x, y: player.pos.y, at: now });
    lastTrailSampleAt = now;
  }
  while (playerTrail.length && now - playerTrail[0].at > 420) playerTrail.shift();
}

// Traînée de confettis lumineux derrière la créature du joueur.
function drawPlayerTrail(now) {
  push();
  noStroke();
  for (let index = 0; index < playerTrail.length; index++) {
    const point = playerTrail[index];
    const fade = constrain(1 - (now - point.at) / 420, 0, 1);
    const taper = (index + 1) / playerTrail.length;
    fill(255, 214, 90, fade * taper * 70);
    circle(point.x, point.y, 4 + taper * 11);
    fill(255, 248, 222, fade * taper * 200);
    circle(point.x, point.y, 2 + taper * 2.5);
  }
  pop();
}

function addVisualEffect(effect) {
  effect.startedAt = millis();
  visualEffects.push(effect);
  if (visualEffects.length > MAX_VISUAL_EFFECTS) visualEffects.splice(0, visualEffects.length - MAX_VISUAL_EFFECTS);
}

function spawnRingEffect(x, y, rgb, duration = 560, radius = 68) {
  addVisualEffect(new SceneRing(x, y, rgb, duration, radius));
}

function spawnSparkBurst(x, y, palette, count = 14) {
  for (let index = 0; index < count; index++) {
    const angle = random(TWO_PI);
    const speed = random(0.7, 3.3);
    addVisualEffect(new SceneParticle(x, y, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: random(1.1, 3.2),
      rgb: random(palette),
      duration: random(420, 780),
    }));
  }
}

function spawnFloatingMessage(x, y, message, rgb) {
  addVisualEffect(new SceneLabel(x, y, message, rgb, 900));
}

function spawnRescueEffects(x, y, spiritProfile) {
  SoundEffects.play('rescue');
  spawnRingEffect(x, y, [244, 218, 153], 620, 74);
  spawnSparkBurst(x, y, [[255, 132, 170], [245, 221, 156], [196, 232, 156]], 18);
  spawnFloatingMessage(x, y, `+1 ${spiritProfile.singular} ${spiritProfile.rescued}`, [255, 237, 194]);
}

function spawnImpactEffects(x, y) {
  SoundEffects.play('capture');
  spawnRingEffect(x, y, [255, 113, 139], 520, 82);
  spawnSparkBurst(x, y, [[255, 112, 132], [242, 183, 126]], 22);
  spawnFloatingMessage(x, y, '−1 énergie', [255, 175, 174]);
}

function spawnLostSpiritEffects(x, y) {
  SoundEffects.play('lost');
  spawnRingEffect(x, y, [188, 151, 119], 450, 48);
  spawnSparkBurst(x, y, [[197, 162, 128], [142, 173, 123]], 9);
  spawnFloatingMessage(x, y, 'Esprit rattrapé', [220, 203, 166]);
}

function spawnDuplicationEffects(sourceX, sourceY, duplicateX, duplicateY) {
  SoundEffects.play('duplicate');
  for (const point of [[sourceX, sourceY], [duplicateX, duplicateY]]) {
    spawnRingEffect(point[0], point[1], [219, 239, 167], 670, 64);
    spawnSparkBurst(point[0], point[1], [[220, 243, 178], [245, 210, 143]], 11);
  }
}

function drawVisualEffects(now) {
  for (let index = visualEffects.length - 1; index >= 0; index--) {
    const effect = visualEffects[index];
    if (effect instanceof SceneParticle || effect instanceof SceneLabel || effect instanceof SceneRing) {
      if (!effect.isAlive(now)) {
        visualEffects.splice(index, 1);
        continue;
      }
      if (gameState === 'playing') {
        effect.steer?.();
        effect.update();
      }
      effect.show(now);
      continue;
    }
    const progress = constrain((now - effect.startedAt) / effect.duration, 0, 1);
    if (progress >= 1) {
      visualEffects.splice(index, 1);
      continue;
    }
    const alpha = 1 - progress;
  }
}

// Effets actifs : un arc-minuterie par effet, de la couleur du jeton ramassé.
function drawPlayerPowerStatus(now) {
  const player = targets.find(target => target.playerControlled);
  if (!player) return;
  const effects = [
    { until: player.speedBoostUntil, duration: SPEED_BOOST_MS, color: PowerUp.COLORS.speed, size: 4.6 },
    { until: player.invisibilityUntil, duration: INVISIBILITY_MS, color: PowerUp.COLORS.invisibility, size: 5.4 },
    { until: player.shieldUntil, duration: SHIELD_MS, color: PowerUp.COLORS.shield, size: 6.2 },
  ];
  push();
  noFill();
  strokeCap(ROUND);
  for (const effect of effects) {
    if (!(now < (effect.until || 0))) continue;
    const diameter = player.r * effect.size;
    stroke(255, 255, 255, 90); strokeWeight(5);
    circle(player.pos.x, player.pos.y, diameter);
    stroke(effect.color); strokeWeight(3.2);
    PaperArt.timerArc(drawingTarget(), player.pos.x, player.pos.y, diameter, (effect.until - now) / effect.duration);
  }
  if (player.isHidden) {
    stroke(190, 255, 214, 220); strokeWeight(2);
    PaperArt.dashedCircle(drawingTarget(), player.pos.x, player.pos.y, player.r * 4, 12, now * 0.002);
  }
  pop();
}

function drawingTarget() {
  return PaperArt.screen();
}

// Menace proche : un cercle pointillé rouge qui se resserre et accélère.
function drawPlayerThreatGlow() {
  const player = targets.find(target => target.playerControlled);
  const nearest = player?.findNearestShip(vehicles);
  if (!player || !nearest || nearest.distance > 210) return;
  const threat = constrain(1 - nearest.distance / 210, 0, 1);
  const now = millis();
  push();
  noFill();
  stroke(255, 79, 94, 30 + threat * 170);
  strokeWeight(1.5 + threat * 1.8);
  PaperArt.dashedCircle(drawingTarget(), player.pos.x, player.pos.y, player.r * (6.4 - threat * 1.6), 18, now * (0.001 + threat * 0.006));
  pop();
}
