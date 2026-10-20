// Déroulement de la partie : démarrage, tutoriel, pause, fin, niveaux, refuges et capture.

function replayGame() {
  const level = MissionProgress.restartLevel(missionProgress, gameState === 'won');
  startGame(false, level);
}

function startGame(withTutorial = false, startingLevel = missionProgress.level) {
  targets.length = 0;
  sanctuaries.length = 0;
  followers.length = 0;
  activeCall = null;
  nextCallAt = 0;
  powerUps.length = 0;
  visualEffects.length = 0;
  playerTrail.length = 0;
  targetLimit = Number(document.getElementById('target-count').value);
  const player = createControlledTarget();
  targets.push(player);
  while (targets.length < targetLimit) targets.push(createPopulationTarget());

  spawnAnchor.set(player.pos.x, player.pos.y);
  score = 0;
  rewardPoints = 0;
  rescueStreak = 0;
  savedTotal = 0;
  missionProgress = MissionProgress.create(startingLevel);
  lostSpirits = 0;
  lives = MAX_LIVES;
  sanctuarySeeds = 0;
  rescueProgress = 0;
  gameElapsedMs = 0;
  gameStartedAt = millis();
  // nouvelle partie : l'horloge des générations d'esprits repart de zéro
  evolutionManager.resetClock(gameStartedAt);
  pausedAt = 0;
  playerInvulnerableUntil = 0;
  nextPowerUpAt = millis() + 1800;
  gameState = 'playing';
  document.getElementById('pause-overlay').hidden = true;
  document.getElementById('level-up-card').hidden = true;
  if (withTutorial) beginTutorial();
  else finishTutorial(false);
  updateTargetCountOutput();
  updateGameHud();
}

function hasCompletedTutorial() {
  try {
    return localStorage.getItem('clairiere-tutorial-complete') === 'true';
  } catch {
    return false;
  }
}

function beginTutorial() {
  if (gameState !== 'playing') return;
  tutorialStage = 0;
  document.getElementById('tutorial-card').hidden = false;
  document.body.classList.add('tutorial-active');
  renderTutorialStep();
}

function renderTutorialStep() {
  if (tutorialStage < 0 || tutorialStage >= TUTORIAL_STEP_COUNT) return;
  const copy = [
    ['Guide la luciole', 'Utilise les flèches ↑ ↓ ← → ou déplace ta souris : la luciole turquoise et dorée te suit et ralentit près de sa destination.'],
    ['Sauve une créature', `Pour la recueillir, touche ${environmentScene.definition.spirit.tutorialTarget.toLowerCase()}. Les veilleurs la poursuivent : approche avec attention.`],
    ['Gagne une graine', sanctuarySeeds > 0
      ? 'Tu as une graine. Tu peux maintenant faire éclore un refuge protecteur.'
      : `Sauve ${RESCUES_PER_SEED - rescueProgress} esprit${RESCUES_PER_SEED - rescueProgress === 1 ? '' : 's'} de plus : chaque groupe de trois donne une graine.`],
    ['Fais éclore un refuge', 'Appuie sur E ou touche la carte « Refuge ». Les esprits sont protégés pendant quelques secondes.'],
    ['Restaure le lieu', `Sauve ${MissionProgress.goalForLevel(missionProgress.level)} ${environmentScene.definition.spirit.plural} avant l’aube. Change de lieu dans Réglages pour découvrir un autre monde.`],
  ];
  copy[0] = ['Guide ta créature', 'Utilise les flèches ↑ ↓ ← → ou déplace ta souris : la créature lumineuse te suit et ralentit près de sa destination.'];
  copy[4] = ['Restaure le lieu', `Sauve ${MissionProgress.goalForLevel(missionProgress.level)} ${environmentScene.definition.spirit.plural} avant l’aube. Change de lieu dans Réglages pour découvrir un autre monde.`];
  document.getElementById('tutorial-title').textContent = copy[tutorialStage][0];
  document.getElementById('tutorial-message').textContent = copy[tutorialStage][1];
  document.getElementById('tutorial-next').textContent = `Passer l’étape ${tutorialStage + 1} / ${TUTORIAL_STEP_COUNT}`;
}

function advanceTutorial() {
  if (tutorialStage < 0) return;
  tutorialStage += 1;
  if (tutorialStage === 2 && sanctuarySeeds > 0) tutorialStage = 3;
  if (tutorialStage >= TUTORIAL_STEP_COUNT) {
    finishTutorial();
    return;
  }
  renderTutorialStep();
}

function finishTutorial(markComplete = true) {
  tutorialStage = -1;
  const card = document.getElementById('tutorial-card');
  if (card) card.hidden = true;
  document.body.classList.remove('tutorial-active');
  if (markComplete) {
    try { localStorage.setItem('clairiere-tutorial-complete', 'true'); } catch { /* Stockage privé ou désactivé. */ }
  }
}

function pauseGame() {
  if (gameState !== 'playing') return;
  const now = millis();
  gameElapsedMs += now - gameStartedAt;
  pausedAt = now;
  gameStartedAt = 0;
  gameState = 'paused';
  updateGameHud();
}

function resumeGame() {
  if (gameState !== 'paused') return;
  const now = millis();
  const pauseDuration = now - pausedAt;
  for (const target of targets) {
    if (Number.isFinite(target.escapeStartedAt)) target.escapeStartedAt += pauseDuration;
    if (target.duplicationStartedAt !== undefined) target.duplicationStartedAt += pauseDuration;
  }
  for (const sanctuary of sanctuaries) sanctuary.createdAt += pauseDuration;
  for (const follower of followers) follower.bornAt += pauseDuration;
  for (const item of powerUps) item.createdAt += pauseDuration;
  playerInvulnerableUntil += pauseDuration;
  nextPowerUpAt += pauseDuration;
  for (const target of targets) {
    if (target.speedBoostUntil) target.speedBoostUntil += pauseDuration;
    if (target.invisibilityUntil) target.invisibilityUntil += pauseDuration;
    if (target.shieldUntil) target.shieldUntil += pauseDuration;
  }
  gameStartedAt = now;
  pausedAt = 0;
  gameState = 'playing';
  updateGameHud();
}

function togglePauseGame() {
  if (gameState === 'playing') pauseGame();
  else if (gameState === 'paused') resumeGame();
}

function endGame(outcome = 'caught') {
  if (gameState !== 'playing') return;
  const now = millis();
  gameElapsedMs += now - gameStartedAt;
  gameStartedAt = 0;
  gameState = outcome === 'restored' ? 'won' : 'over';
  document.getElementById('end-title').textContent = outcome === 'restored'
    ? 'La clairière renaît' : outcome === 'dawn' ? 'Le jour se lève' : 'La nuit est trop dangereuse';
  document.getElementById('end-message').textContent = outcome === 'restored'
    ? `Tu as sauvé ${savedTotal} esprits, gagné ${rewardPoints} éclats magiques et rendu sa lumière à ce lieu.`
    : outcome === 'dawn'
      ? `Tu as sauvé ${savedTotal} esprit${savedTotal > 1 ? 's' : ''}. Reprends au niveau ${missionProgress.level} pour continuer.`
      : `Tu as sauvé ${savedTotal} esprit${savedTotal > 1 ? 's' : ''} avant d’épuiser tes trois énergies. Reprends au niveau ${missionProgress.level}.`;
  document.getElementById('end-replay').textContent = outcome === 'restored'
    ? 'Nouvelle partie' : `Reprendre le niveau ${missionProgress.level}`;
  document.getElementById('end-card').hidden = false;
  document.getElementById('pause-overlay').hidden = true;
  finishTutorial(false);
  updateGameHud();
}

function elapsedGameTime(now = millis()) {
  return gameElapsedMs + (gameState === 'playing' ? now - gameStartedAt : 0);
}

function formatGameTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function bloomSanctuary() {
  if (gameState !== 'playing' || sanctuarySeeds < 1) return false;
  SoundEffects.play('sanctuary');
  const player = targets.find(target => target.playerControlled);
  if (!player) return false;

  const marginX = Math.min(Sanctuary.RADIUS, width / 2);
  const marginY = Math.min(Sanctuary.RADIUS, height / 2);
  const x = constrain(player.pos.x, marginX, width - marginX);
  const y = constrain(player.pos.y, marginY, height - marginY);
  const sanctuary = new Sanctuary(x, y, millis());
  if (sanctuaries.length >= MAX_ACTIVE_SANCTUARIES) sanctuaries.shift();
  sanctuaries.push(sanctuary);
  sanctuarySeeds -= 1;
  if (tutorialStage === 3) advanceTutorial();
  spawnRingEffect(x, y, [204, 239, 165], 900, Sanctuary.RADIUS * 1.8);
  spawnSparkBurst(x, y, [[216, 242, 173], [255, 227, 164], [255, 244, 206]], 22);
  spawnFloatingMessage(x, y, 'Refuge fleuri', [232, 247, 194]);
  updateGameHud();
  return true;
}

function grantSanctuarySeed(x, y) {
  rescueProgress += 1;
  if (rescueProgress >= RESCUES_PER_SEED) {
    rescueProgress -= RESCUES_PER_SEED;
    sanctuarySeeds = Math.min(MAX_SANCTUARY_SEEDS, sanctuarySeeds + 1);
    spawnRingEffect(x, y, [213, 240, 166], 700, 52);
    spawnFloatingMessage(x, y, 'Graine de refuge +1', [232, 247, 194]);
  }
  if (tutorialStage === 2 && sanctuarySeeds > 0) advanceTutorial();
  updateGameHud();
}

function advanceMissionLevel(transition, now) {
  SoundEffects.play('level');
  gameElapsedMs = 0;
  gameStartedAt = now;
  playerInvulnerableUntil = Math.max(playerInvulnerableUntil, now + PLAYER_INVULNERABILITY_MS);
  const spiritProfile = environmentScene.definition.spirit;
  const banner = document.getElementById('level-up-card');
  const levelReward = MissionProgress.rewardForLevel(transition.completedLevel);
  rewardPoints += levelReward;
  const earnedEnergy = lives < MAX_LIVES;
  if (earnedEnergy) lives += 1;
  applyEnvironment(environmentScene.id);
  document.getElementById('level-up-title').textContent = `Niveau ${transition.level} · ${environmentScene.definition.label || 'nouveau chapitre'}`;
  document.getElementById('level-up-message').textContent =
    `Nouvelle mission : sauve ${transition.goal} ${spiritProfile.plural}. +${levelReward} éclats${earnedEnergy ? ' et +1 énergie' : ''} · carte renouvelée.`;
  banner.hidden = false;
  banner.classList.remove('level-up-visible');
  void banner.offsetWidth;
  banner.classList.add('level-up-visible');
  showLevelCelebration(transition.level, environmentScene.definition.label || 'La Clairière');
  window.clearTimeout(levelUpTimeout);
  levelUpTimeout = window.setTimeout(() => { banner.hidden = true; }, 3200);
  const player = targets.find(target => target.playerControlled);
  if (player) {
    spawnRingEffect(player.pos.x, player.pos.y, [235, 245, 191], 1100, 124);
    spawnSparkBurst(player.pos.x, player.pos.y, [[232, 248, 192], [247, 224, 164], [186, 227, 202]], 28);
  }
  updateGameHud();
}

function showLevelCelebration(level, place) {
  const overlay = document.getElementById('celebration-overlay');
  if (!overlay) return;
  document.getElementById('celebration-title').textContent = `Niveau ${level} débloqué !`;
  document.getElementById('celebration-message').textContent = `${place} s’illumine : tu as restauré un peu plus de magie.`;
  overlay.hidden = false;
  overlay.classList.remove('celebration-active');
  void overlay.offsetWidth;
  overlay.classList.add('celebration-active');
  window.clearTimeout(celebrationTimeout);
  celebrationTimeout = window.setTimeout(() => {
    overlay.classList.remove('celebration-active');
    overlay.hidden = true;
  }, 3600);
}

function handlePlayerCapture(player, now) {
  if (now < playerInvulnerableUntil || gameState !== 'playing') return;
  spawnImpactEffects(player.pos.x, player.pos.y);
  lives = Math.max(0, lives - 1);
  rescueStreak = 0;
  playerInvulnerableUntil = now + PLAYER_INVULNERABILITY_MS;
  // Règle de scène explicite (pas du steering) : la luciole capturée réapparaît
  // immobile dans une zone sûre, comme une nouvelle naissance.
  const position = findSafeTargetPosition();
  player.pos.set(position.x, position.y);
  player.vel.set(0, 0);
  player.acc.set(0, 0);
  player.escapeStartedAt = null;
  player.hasDuplicated = false;
  spawnAnchor.set(position.x, position.y);
  updateGameHud();
  if (lives === 0) endGame('caught');
}
