// Contrôleur de scène des esprits : sauvetages, bonus, puis pour chaque cible
// think → steer, et enfin une seule locomotion par image.

function updateTargets(now) {
  const player = targets.find(target => target.playerControlled);
  const wildTargets = targets.filter(target => !target.playerControlled);

  // Traverser un esprit sauvage le recueille avant que les veilleurs ne l'attrapent.
  if (player) {
    for (const target of [...targets]) {
      if (target.playerControlled || target.duplicationStartedAt !== undefined) continue;
      const pickupRadius = player.r + target.r + 8;
      if (p5.Vector.sub(player.pos, target.pos).magSq() <= pickupRadius ** 2) {
        const spiritProfile = environmentScene.definition.spirit;
        spiritBrainPool.record(target, true);
        spawnRescueEffects(target.pos.x, target.pos.y, spiritProfile);
        joinCortege(target, player, now);
        targets.splice(targets.indexOf(target), 1);
        score += 1;
        savedTotal += 1;
        rescueStreak += 1;
        rewardPoints += 10;
        if (rescueStreak > 0 && rescueStreak % 3 === 0) {
          rewardPoints += 5;
          spawnFloatingMessage(target.pos.x, target.pos.y, `Combo ×${rescueStreak} · +5 éclats`, [255, 218, 128]);
          spawnSparkBurst(target.pos.x, target.pos.y, [[255, 218, 128], [208, 246, 186], [173, 231, 255]], 12);
        }
        const transition = MissionProgress.recordRescue(missionProgress);
        grantSanctuarySeed(target.pos.x, target.pos.y);
        updateGameHud();
        if (tutorialStage === 1) advanceTutorial();
        if (transition.completed) advanceMissionLevel(transition, now);
      }
    }
  }

  if (player) {
    for (let index = powerUps.length - 1; index >= 0; index--) {
      const item = powerUps[index];
      if (item.isExpired(now)) { powerUps.splice(index, 1); continue; }
      if (p5.Vector.dist(player.pos, item.pos) <= player.r + item.r + 7) {
        collectPowerUp(player, item, now);
        powerUps.splice(index, 1);
      }
    }
    player.isHidden = hideSpots.some(spot => spot.contains(player));
    player.isSheltered = sanctuaries.some(sanctuary => sanctuary.contains(player));
  }

  // 1. perception et décision (think), 2. steering (steer) pour chaque cible…
  for (const target of [...targets]) {
    const isInvulnerablePlayer = target.playerControlled && now < playerInvulnerableUntil;
    const isSheltered = target.playerControlled && (target.isHidden || target.isSheltered);
    const hasPowerProtection = target.playerControlled && (now < (target.invisibilityUntil || 0) || now < (target.shieldUntil || 0));
    const hunters = isInvulnerablePlayer || isSheltered || hasPowerProtection ? [] : vehicles;
    const neighbors = target.playerControlled ? [] : wildTargets;
    const context = { pointerGoal: target.playerControlled ? pointerGoal : null, neighbors, obstacles, player, sanctuaries, call: currentCall(now) };
    if (target.think(hunters, now, context)) {
      if (target.playerControlled) {
        handlePlayerCapture(target, now);
        if (gameState !== 'playing') return;
      } else {
        spiritBrainPool.record(target, false);
        spawnLostSpiritEffects(target.pos.x, target.pos.y);
        targets.splice(targets.indexOf(target), 1);
        lostSpirits += 1;
        updateGameHud();
      }
      continue;
    }
    target.steer(context);
  }
  // … 3. puis la locomotion héritée de Vehicle : une seule intégration par image et par cible.
  for (const target of targets) {
    target.update();
    target.edges();
  }
  updateCortege(now);

  for (const target of [...targets]) {
    if (target.hasDuplicated || !target.shouldDuplicate(now)) continue;
    const pendingCount = targets.filter(item => item.duplicationStartedAt !== undefined).length;
    if (targets.length + pendingCount >= MAX_TARGETS) continue;
    target.hasDuplicated = true;
    target.beginDuplicationAnimation(now);
  }

  const completedDuplications = [];
  for (const target of [...targets]) {
    const duplicatePosition = target.completeDuplicationAnimation(now);
    if (duplicatePosition) completedDuplications.push({ source: target, position: duplicatePosition });
  }
  for (const duplication of completedDuplications) {
    if (targets.length < MAX_TARGETS) {
      targets.push(createDuplicate(duplication.source, duplication.position));
      spawnDuplicationEffects(duplication.source.pos.x, duplication.source.pos.y, duplication.position.x, duplication.position.y);
    }
  }

  while (targets.length < targetLimit) targets.push(createPopulationTarget());
  updateTargetCountOutput();
}

// ---------- cortège des esprits sauvés ----------
// Règle de scène : un esprit sauvé quitte la population et rejoint la file derrière la
// luciole. Chaque esprit suit le précédent (leader following + arrive avec décalage).
function joinCortege(spirit, player, now) {
  const leader = followers.length ? followers[followers.length - 1] : player;
  const follower = new FollowerSpirit(spirit.pos.x, spirit.pos.y, spirit.spiritKind, leader, now);
  follower.vel.set(spirit.vel);
  followers.push(follower);
  if (followers.length > FollowerSpirit.MAX_COUNT) followers.shift();
  relinkCortege(player);
}

// le premier esprit suit la luciole, chacun des suivants suit celui qui le précède
function relinkCortege(player) {
  followers.forEach((follower, index) => { follower.leader = index === 0 ? player : followers[index - 1]; });
}

function updateCortege(now) {
  const player = targets.find(target => target.playerControlled);
  for (let index = followers.length - 1; index >= 0; index--) {
    if (followers[index].isAlive(now)) continue;
    const gone = followers.splice(index, 1)[0];
    spawnSparkBurst(gone.pos.x, gone.pos.y, [[255, 244, 194], [208, 246, 186]], 6);
  }
  if (!player) return;
  relinkCortege(player);
  for (const follower of followers) follower.steer(followers);
  for (const follower of followers) {
    follower.update();
    follower.edges();
  }
}

// ---------- migration des feux follets (algorithme génétique, exemple 10) ----------
// Une image de vol ; les veilleurs sont des dangers mobiles. Chaque feu follet arrivé au nid
// rapporte un éclat au joueur.
function updateMigration() {
  WispMigration.update(obstacles, vehicles, wisp => {
    rewardPoints += 1;
    spawnSparkBurst(wisp.pos.x, wisp.pos.y, [[180, 255, 230], [255, 244, 194]], 5);
  });
}
