// Mise en place du monde (règles de scène) : décor, obstacles, cachettes, bonus,
// création et placement des esprits. Aucun steering ici.

function applyEnvironment(id) {
  if (!environmentScene) return;
  const selector = document.getElementById('environment-select');
  const selected = ENVIRONMENT_DEFINITIONS[id] ? id : 'emerald';
  if (selector && selector.value !== selected) selector.value = selected;
  environmentScene.setEnvironment(selected, width, height);
  for (const target of targets) target.setSpiritKind(environmentScene.definition.spirit.kind);
  // transition de scénario : la fuite de chaque esprit repart de zéro, sans recréer la population
  for (const target of targets) target.resetEscape();
  for (const vehicle of vehicles) vehicle.setGuardian(environmentScene.definition.guardian);
  obstacles.splice(0, obstacles.length, ...environmentScene.createObstacles(width, height));
  addLevelMapObstacles();
  createHideSpots();
  patrolPath = environmentScene.patrolPath(width, height);
  resolveEntitiesAfterEnvironmentChange();
  // les feux follets gardent leur ADN appris et repartent du bord du nouveau décor
  WispMigration.relocate(width, height);
  if (tutorialStage >= 0) renderTutorialStep();
}

function addLevelMapObstacles() {
  if (!environmentScene || width < 260 || height < 240) return;
  const level = Math.max(1, missionProgress?.level || 1);
  const count = Math.min(7, 2 + Math.floor((level - 1) / 2));
  const patterns = [
    [0.27, 0.34], [0.73, 0.37], [0.48, 0.67], [0.18, 0.65],
    [0.82, 0.68], [0.38, 0.49], [0.64, 0.53], [0.52, 0.27],
    [0.31, 0.78], [0.7, 0.78], [0.14, 0.34], [0.86, 0.32],
  ];
  const extra = environmentScene.definition.extraObstacle;
  const kind = PropArt.has(extra) ? extra : 'mossy-rock';
  let added = 0;
  for (let index = 0; index < patterns.length && added < count; index++) {
    const patternIndex = (index + (level - 1) * 3) % patterns.length;
    const [rx, ry] = patterns[patternIndex];
    const radius = 13 + ((level + index) % 3) * 2;
    const point = createVector(width * rx, height * ry);
    if (point.x < 48 || point.x > width - 48 || point.y < 145 || point.y > height - 38) continue;
    const overlaps = obstacles.some(item => p5.Vector.dist(item.pos, point) < item.r + radius + 18);
    if (overlaps) continue;
    obstacles.push(new Obstacle(point.x, point.y, radius, kind));
    added++;
  }
}

function createHideSpots() {
  hideSpots.length = 0;
  const candidates = [
    [0.12, 0.48], [0.88, 0.49], [0.42, 0.86], [0.62, 0.17],
    [0.1, 0.78], [0.9, 0.82], [0.35, 0.18], [0.67, 0.86],
  ];
  const kind = environmentScene?.definition.hideSpot || 'fern-bush';
  for (const [rx, ry] of candidates) {
    if (hideSpots.length >= 3) break;
    const point = createVector(width * rx, height * ry);
    const clear = obstacles.every(obstacle => p5.Vector.dist(obstacle.pos, point) > obstacle.r + HideSpot.RADIUS + 12)
      && hideSpots.every(spot => p5.Vector.dist(spot.pos, point) > HideSpot.RADIUS * 2.4);
    if (clear) hideSpots.push(new HideSpot(point.x, point.y, kind));
  }
}

function spawnPowerUp(now = millis()) {
  if (powerUps.length >= 4 || width < 120 || height < 120) return false;
  const margin = 54;
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = random(margin, Math.max(margin, width - margin));
    const y = random(margin, Math.max(margin, height - margin));
    const point = createVector(x, y);
    const clear = obstacles.every(item => p5.Vector.dist(item.pos, point) > item.r + 30)
      && hideSpots.every(item => p5.Vector.dist(item.pos, point) > item.r + 25)
      && powerUps.every(item => p5.Vector.dist(item.pos, point) > 70);
    if (clear) {
      const types = PowerUp.TYPES;
      const type = random(types);
      powerUps.push(new PowerUp(x, y, type, now));
      spawnSparkBurst(x, y, [[255, 224, 128], [154, 232, 255], [224, 193, 255]], 9);
      return true;
    }
  }
  return false;
}

function collectPowerUp(player, item, now) {
  SoundEffects.play('powerup');
  if (item.type === 'speed') {
    player.speedBoostUntil = now + SPEED_BOOST_MS;
    spawnFloatingMessage(item.pos.x, item.pos.y, 'Vitesse ×1,7', [255, 211, 105]);
  } else if (item.type === 'invisibility') {
    player.invisibilityUntil = now + INVISIBILITY_MS;
    spawnFloatingMessage(item.pos.x, item.pos.y, 'Invisible !', [146, 233, 255]);
  } else if (item.type === 'shield') {
    player.shieldUntil = now + SHIELD_MS;
    spawnFloatingMessage(item.pos.x, item.pos.y, 'Bouclier magique', [216, 183, 255]);
  } else {
    if (lives < MAX_LIVES) {
      lives += 1;
      spawnFloatingMessage(item.pos.x, item.pos.y, '+1 énergie', [255, 160, 185]);
    } else {
      player.shieldUntil = now + 3500;
      spawnFloatingMessage(item.pos.x, item.pos.y, 'Bouclier bonus', [216, 183, 255]);
    }
    updateGameHud();
  }
  spawnRingEffect(item.pos.x, item.pos.y, [175, 239, 255], 620, 74);
  spawnSparkBurst(item.pos.x, item.pos.y, [[255, 224, 128], [154, 232, 255], [224, 193, 255]], 18);
}

function setTargetPopulation(count) {
  targetLimit = constrain(Math.round(count), 1, MAX_TARGETS);
  const controlledTarget = targets.find(target => target.playerControlled);

  while (targets.length > targetLimit) {
    let removeIndex = -1;
    for (let index = targets.length - 1; index >= 0; index--) {
      if (targets[index] !== controlledTarget) {
        removeIndex = index;
        break;
      }
    }
    if (removeIndex < 0) break;
    targets.splice(removeIndex, 1);
  }

  while (targets.length < targetLimit) targets.push(createPopulationTarget());
  if (targets.length > 0 && !targets.some(target => target.playerControlled)) {
    targets[0].playerControlled = true;
  }
  updateTargetCountOutput();
}

function updateTargetCountOutput() {
  const slider = document.getElementById('target-count');
  const output = document.getElementById('target-count-value');
  if (slider) slider.value = Math.max(1, targets.length);
  if (output) output.value = `${targets.length} / ${MAX_TARGETS}`;
}

function createControlledTarget() {
  const position = findSafeTargetPosition();
  const target = new FleeTarget(position.x, position.y, targetSpeed, true);
  target.setSpiritKind(environmentScene?.definition.spirit.kind ?? 'firefly');
  target.setManualSpeed(cursorSpeed);
  target.playerIcon = selectedPlayerIcon;
  return target;
}

function createPopulationTarget() {
  const position = findSafeTargetPosition();
  const target = neuralSpiritsEnabled
    ? new NeuralSpirit(position.x, position.y, targetSpeed, false, spiritBrainPool.breed())
    : new FleeTarget(position.x, position.y, targetSpeed, false);
  target.setSpiritKind(environmentScene?.definition.spirit.kind ?? 'firefly');
  target.setManualSpeed(cursorSpeed);
  return target;
}

function findSafeTargetPosition() {
  const marginX = Math.min(FleeTarget.DETECTION_RADIUS + 16, width / 2);
  const marginY = Math.min(FleeTarget.DETECTION_RADIUS + 16, height / 2);
  const safe = position => {
    const clearOfShips = vehicles.every(ship => p5.Vector.dist(ship.pos, position) > FleeTarget.DETECTION_RADIUS + ship.r);
    const clearOfObstacles = obstacles.every(obstacle => p5.Vector.dist(obstacle.pos, position) > obstacle.r + 12);
    const clearOfTargets = targets.every(target => p5.Vector.dist(target.pos, position) > FleeTarget.DETECTION_RADIUS * 1.45 + target.r);
    return clearOfShips && clearOfObstacles && clearOfTargets;
  };
  for (let attempt = 0; attempt < 96; attempt++) {
    const position = createVector(random(marginX, Math.max(marginX, width - marginX)), random(marginY, Math.max(marginY, height - marginY)));
    if (safe(position)) return position;
  }
  // Repli déterministe sur une grille. On ne renvoie jamais le centre sans vérification.
  let best = createVector(width / 2, height / 2);
  let bestClearance = -Infinity;
  const step = Math.max(24, Math.min(56, FleeTarget.DETECTION_RADIUS));
  for (let y = step; y < height; y += step) {
    for (let x = step; x < width; x += step) {
      const point = createVector(x, y);
      if (safe(point)) return point;
      let clearance = Infinity;
      for (const ship of vehicles) clearance = Math.min(clearance, p5.Vector.dist(ship.pos, point) - FleeTarget.DETECTION_RADIUS - ship.r);
      for (const obstacle of obstacles) clearance = Math.min(clearance, p5.Vector.dist(obstacle.pos, point) - obstacle.r - 12);
      for (const target of targets) clearance = Math.min(clearance, p5.Vector.dist(target.pos, point) - FleeTarget.DETECTION_RADIUS * 1.45 - target.r);
      if (clearance > bestClearance) { bestClearance = clearance; best = point; }
    }
  }
  return best;
}

function resolveEntitiesAfterEnvironmentChange() {
  const entities = [...targets, ...vehicles];
  for (const entity of entities) {
    const overlapping = obstacles.some(obstacle => p5.Vector.dist(obstacle.pos, entity.pos) < obstacle.r + entity.r + 8);
    if (!overlapping) continue;
    // Règle de scène explicite : après un changement de décor, une entité prise
    // dans un nouvel obstacle réapparaît dans une zone libre.
    const previous = entity.pos.copy();
    const position = findSafeTargetPosition();
    entity.pos.set(position);
    entity.vel.set(0, 0);
    entity.acc.set(0, 0);
    if (entity.playerControlled) spawnAnchor?.set(position);
    if (p5.Vector.dist(previous, position) > 2) spawnRingEffect(position.x, position.y, [177, 226, 197], 420, 38);
  }
}

function createDuplicate(source, position) {
  const duplicate = source.duplicateAt(position.x, position.y);
  duplicate.wanderHeading = source.wanderHeading + random(-0.4, 0.4);
  return duplicate;
}
