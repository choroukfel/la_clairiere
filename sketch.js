// Point d'entrée p5.js : setup, boucle draw et redimensionnement.
// L'état est dans gameState.js ; chaque module gère une responsabilité.

function sceneHeight() {
  return Math.max(1, windowHeight);
}

function setup() {
  if (typeof PRETRAINED_SPIRIT_BRAINS !== 'undefined') spiritBrainPool.seed(PRETRAINED_SPIRIT_BRAINS);
  sceneCanvas = createCanvas(windowWidth, sceneHeight());
  sceneCanvas.parent('scene');
  environmentScene = new EnvironmentScene('emerald');
  applyEnvironment('emerald');
  WispMigration.reset(width, height);
  // Le point rose sert de curseur : le pointeur système reste masqué sur le canvas.
  sceneCanvas.elt.style.cursor = 'none';
  sceneCanvas.elt.addEventListener('pointerenter', updatePointerGoal);
  sceneCanvas.elt.addEventListener('pointermove', updatePointerGoal);
  // tactile : un toucher place le but, un glissement le déplace ; le navigateur ne doit
  // ni faire défiler ni zoomer la page pendant le glissement
  sceneCanvas.elt.addEventListener('pointerdown', updatePointerGoal);
  sceneCanvas.elt.style.touchAction = 'none';
  // Conserver la dernière position connue : sortir du canvas ne déclenche pas une errance imprévisible.

  const settingsPanel = document.getElementById('settings-panel');
  const settingsToggle = document.getElementById('settings-toggle');
  settingsToggle.addEventListener('click', () => {
    if (gameState === 'playing') {
      pauseGame();
      resumeAfterSettings = true;
    }
    settingsToggle.setAttribute('aria-expanded', 'true');
    settingsPanel.showModal();
  });
  settingsPanel.addEventListener('close', () => {
    settingsToggle.setAttribute('aria-expanded', 'false');
    if (resumeAfterSettings && gameState === 'paused') {
      resumeAfterSettings = false;
      resumeGame();
    }
  });
  settingsPanel.addEventListener('click', event => {
    if (event.target === settingsPanel) settingsPanel.close();
  });
  document.getElementById('settings-close').addEventListener('click', () => settingsPanel.close());
  document.getElementById('game-replay').addEventListener('click', replayGame);
  document.getElementById('pause-toggle').addEventListener('click', togglePauseGame);
  document.getElementById('pause-resume').addEventListener('click', resumeGame);
  document.getElementById('pause-restart').addEventListener('click', replayGame);
  document.getElementById('evolution-enabled').addEventListener('change', event => { evolutionManager.enabled = event.currentTarget.checked; });
  document.getElementById('steering-debug-enabled').addEventListener('change', event => { steeringDebugEnabled = event.currentTarget.checked; });
  // appliqué aux prochaines naissances : la population en place n'est pas recréée
  document.getElementById('neural-spirits-enabled').addEventListener('change', event => { neuralSpiritsEnabled = event.currentTarget.checked; });
  neuralSpiritsEnabled = document.getElementById('neural-spirits-enabled').checked;
  document.getElementById('end-replay').addEventListener('click', replayGame);
  document.getElementById('tutorial-help').addEventListener('click', () => {
    if (gameState === 'playing') beginTutorial();
    else startGame(true);
  });
  document.getElementById('tutorial-next').addEventListener('click', advanceTutorial);
  document.getElementById('tutorial-finish').addEventListener('click', finishTutorial);
  document.getElementById('sanctuary-trigger').addEventListener('click', bloomSanctuary);
  document.getElementById('call-trigger').addEventListener('click', event => { emitCall(0.4); event.currentTarget.blur(); });
  document.getElementById('environment-select').addEventListener('change', event => applyEnvironment(event.currentTarget.value));
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('button, input, select, textarea, [contenteditable="true"]')) return;
    if (!event.repeat && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      togglePauseGame();
      return;
    }
    if (!event.repeat && event.key.toLowerCase() === 'c' && gameState === 'playing') {
      event.preventDefault();
      emitCall(0.4);
      return;
    }
    if (!event.repeat && event.key === 'Escape' && gameState === 'paused') {
      event.preventDefault();
      resumeGame();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      if (gameState !== 'playing') return;
      if (!keyboardControl) {
        const player = targets.find(target => target.playerControlled);
        if (player) pointerGoal = player.pos.copy();
      }
      keyboardControl = true;
      return;
    }
    if (event.repeat || event.key.toLowerCase() !== 'e') return;
    bloomSanctuary();
  });

  spawnAnchor = createVector(width / 2, height / 2);
  targets.push(createControlledTarget());

  const vehicleSlider = document.getElementById('vehicle-count');
  SeekPopulation.bindSlider(vehicleSlider, document.getElementById('vehicle-count-value'),
    vehicles, spawnAnchor, () => ({ width, height }), (x, y) => new SeekVehicle(x, y, environmentScene?.definition.guardian));

  const targetSlider = document.getElementById('target-count');
  targetLimit = Number(targetSlider.value);
  targetSlider.addEventListener('input', () => setTargetPopulation(Number(targetSlider.value)));
  setTargetPopulation(targetLimit);

  bindSpeedControl('target-speed', 'target-speed-value', value => {
    targetSpeed = value;
    for (const target of targets) target.setSpeed(value);
  });
  bindSpeedControl('cursor-speed', 'cursor-speed-value', value => {
    cursorSpeed = value;
    for (const target of targets) target.setManualSpeed(value);
  });
  document.getElementById('sound-enabled').addEventListener('change', event => {
    soundEnabled = event.currentTarget.checked;
    if (soundEnabled) userStartAudio();
    updateMotionSound();
  });

  const volumeSlider = document.getElementById('sound-volume');
  const volumeOutput = document.getElementById('sound-volume-value');
  volumeSlider.addEventListener('input', () => {
    soundVolume = Number(volumeSlider.value) / 100;
    volumeOutput.value = `${volumeSlider.value} %`;
  evolutionManager.enabled = document.getElementById('evolution-enabled').checked;
    if (soundWasActive) motionTone.amp(0.07 * soundVolume, 0.08);
  });
  volumeOutput.value = `${volumeSlider.value} %`;
  evolutionManager.enabled = document.getElementById('evolution-enabled').checked;
  document.getElementById('sound-tone').addEventListener('change', event => {
    motionTone.setType(event.currentTarget.value);
  });

  motionTone = new p5.Oscillator('sine');
  motionTone.freq(440);
  motionTone.amp(0);
  motionTone.start();
  gameState = 'menu';
  document.body.classList.add('menu-active');
  document.getElementById('start-screen').hidden = false;
  bindStartScreen();
  bindMicrophone();
  document.getElementById('migration-enabled').addEventListener('change', event => { WispMigration.enabled = event.currentTarget.checked; });
  renderMenuArtwork();
}

function draw() {
  const now = millis();
  updateKeyboardMovement();
  environmentScene.drawBackground(width, height);
  environmentScene.drawAmbientMotion(width, height, now);
  if (gameState === 'playing') environmentScene.updateElements(width, height);
  const sanctuaryTime = gameState === 'paused' ? pausedAt : now;
  for (let index = sanctuaries.length - 1; index >= 0; index--) {
    if (sanctuaries[index].isExpired(sanctuaryTime)) sanctuaries.splice(index, 1);
  }
  if (gameState === 'playing') {
    if (now >= nextPowerUpAt) {
      spawnPowerUp(now);
      nextPowerUpAt = now + POWERUP_RESPAWN_MS;
    }
    handleMicrophone(now);
    updateTargets(now);
    updateMigration();
    evolutionManager.update(targets, now);
    if (gameState === 'playing' && elapsedGameTime(now) >= MISSION_DURATION_MS) endGame('dawn');
    const spawnTarget = targets.find(target => target.playerControlled) ?? targets[0];
    if (spawnTarget) spawnAnchor.set(spawnTarget.pos.x, spawnTarget.pos.y);
  }
  updateMotionSound();
  updateGameHud();
  updatePlayerTrail(now);
  for (const sanctuary of sanctuaries) sanctuary.show(sanctuaryTime);
  drawPlayerTrail(now);

  for (const vehicle of vehicles) {
    if (gameState === 'playing') {
      vehicle.hear(currentCall(now), now);
      const target = vehicle.chooseBehaviorTarget(targets, now, missionProgress.level, obstacles);
      if (target && !target.memoryTarget) {
        SeekPopulation.step(vehicle, target, width, height, Math.random, obstacles, sanctuaries, patrolPath);
      } else {
        vehicle.applyBehaviors(target, obstacles, sanctuaries, patrolPath);
        vehicle.update();
        vehicle.edges();
        if (target?.memoryTarget && p5.Vector.dist(vehicle.pos, target.pos) <= vehicle.investigationRadius) {
          vehicle.aiState = 'patrol';
          vehicle.lastKnownPosition = null;
        }
      }
    }
  }

  // Diorama : les figurines sont dessinées du fond vers l'avant (tri sur y).
  const figures = [...hideSpots, ...obstacles, ...powerUps, ...vehicles, ...followers, ...targets];
  figures.sort((a, b) => a.pos.y - b.pos.y);
  for (const figure of figures) figure.show(figure instanceof PowerUp || figure instanceof HideSpot ? sanctuaryTime : now);
  WispMigration.show(now);
  environmentScene.showElements(now);
  drawPlayerThreatGlow();
  drawPlayerPowerStatus(now);
  drawVisualEffects(now);
  if (steeringDebugEnabled) drawSteeringDebug();
}

function windowResized() {
  resizeCanvas(windowWidth, sceneHeight());
  applyEnvironment(environmentScene.id);
  spawnAnchor.set(constrain(spawnAnchor.x, 0, width), constrain(spawnAnchor.y, 0, height));
  // Règle de scène explicite : la fenêtre a rétréci, les entités restent dans le canvas.
  for (const target of targets) {
    target.pos.set(constrain(target.pos.x, 0, width), constrain(target.pos.y, 0, height));
  }
  if (pointerGoal) pointerGoal.set(constrain(pointerGoal.x, 0, width), constrain(pointerGoal.y, 0, height));
  for (const element of environmentScene.elements) element.pos.set(constrain(element.pos.x, 0, width), constrain(element.pos.y, 0, height));
  for (const vehicle of vehicles) vehicle.edges();
}
