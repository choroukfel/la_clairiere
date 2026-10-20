// Interface DOM : score, vies, minuterie, mission, graines et état du réservoir neuronal.

function formatSpeed(value) {
  return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function bindSpeedControl(sliderId, outputId, onChange) {
  const slider = document.getElementById(sliderId);
  const output = document.getElementById(outputId);
  const synchronize = () => {
    const value = Number(slider.value);
    output.value = formatSpeed(value);
    onChange(value);
  };
  slider.addEventListener('input', synchronize);
  synchronize();
}

// Bilan du réservoir neuronal, affiché dans les réglages.
function updateNeuralStatus() {
  const output = document.getElementById('neural-spirits-status');
  if (!output) return;
  const best = spiritBrainPool.best();
  const neuralCount = targets.filter(target => target instanceof NeuralSpirit).length;
  const text = `${neuralCount} ${neuralCount > 1 ? 'esprits neuronaux' : 'esprit neuronal'} · `
    + `${spiritBrainPool.entries.length} cerveaux en mémoire · sauvés ${spiritBrainPool.rescued}, attrapés ${spiritBrainPool.caught}`
    + (spiritBrainPool.rescued + spiritBrainPool.caught > 0 ? ` (${Math.round(spiritBrainPool.rescueRate() * 100)} % sauvés)` : '')
    + (best ? ` · meilleur score ${best.fitness.toFixed(1)}` : '');
  if (output.textContent !== text) output.textContent = text;
}

function updateGameHud() {
  updateNeuralStatus();
  const migration = document.getElementById('migration-status');
  const migrationText = WispMigration.enabled ? WispMigration.status() : '';
  if (migration && migration.textContent !== migrationText) migration.textContent = migrationText;
  const scoreOutput = document.getElementById('score-value');
  const rewardOutput = document.getElementById('reward-value');
  const livesOutput = document.getElementById('lives-value');
  const timerOutput = document.getElementById('timer-value');
  const sanctuaryOutput = document.getElementById('sanctuary-count');
  const sanctuaryProgress = document.getElementById('sanctuary-progress');
  const sanctuaryButton = document.getElementById('sanctuary-trigger');
  const replayButton = document.getElementById('game-replay');
  const scoreText = String(score);
  const missionGoal = MissionProgress.goalForLevel(missionProgress.level);
  const livesText = `${'♥ '.repeat(lives)}${'♡ '.repeat(MAX_LIVES - lives)}`.trim();
  const remainingMs = Math.max(0, MISSION_DURATION_MS - elapsedGameTime());
  const timerText = formatGameTime(remainingMs);
  if (scoreOutput.textContent !== scoreText) {
    scoreOutput.textContent = scoreText;
    const scoreCard = scoreOutput.closest('.score-card');
    scoreCard?.classList.remove('score-bump');
    if (scoreCard) {
      void scoreCard.offsetWidth;
      scoreCard.classList.add('score-bump');
    }
  }
  if (rewardOutput.textContent !== String(rewardPoints)) rewardOutput.textContent = String(rewardPoints);
  if (livesOutput.textContent !== livesText) livesOutput.textContent = livesText;
  const energyLabel = `${lives} énergie${lives > 1 ? 's' : ''} restante${lives > 1 ? 's' : ''}`;
  if (livesOutput.getAttribute('aria-label') !== energyLabel) livesOutput.setAttribute('aria-label', energyLabel);
  if (timerOutput.textContent !== timerText) timerOutput.textContent = timerText;
  const missionCount = document.getElementById('mission-count');
  const missionFill = document.getElementById('mission-fill');
  const missionTrack = document.querySelector('.mission-track');
  const missionDescription = document.getElementById('mission-description');
  const missionText = `${missionProgress.rescued} / ${missionGoal}`;
  if (missionCount.textContent !== missionText) missionCount.textContent = missionText;
  missionFill.style.width = `${Math.min(100, missionProgress.rescued / missionGoal * 100)}%`;
  missionTrack.setAttribute('aria-valuemax', String(missionGoal));
  missionTrack.setAttribute('aria-valuenow', String(missionProgress.rescued));
  document.getElementById('level-number').textContent = String(missionProgress.level);
  const spiritProfile = environmentScene?.definition.spirit ?? ENVIRONMENT_DEFINITIONS.emerald.spirit;
  missionDescription.textContent = gameState === 'won'
    ? 'La clairière a retrouvé sa lumière.'
    : gameState === 'over' ? `${lostSpirits} créature${lostSpirits === 1 ? '' : 's'} perdue${lostSpirits === 1 ? '' : 's'} pendant cette nuit.`
      : `Sauve ${missionGoal} ${spiritProfile.plural} avant l’aube.`;
  document.getElementById('end-card').hidden = gameState !== 'won' && gameState !== 'over';
  const sanctuaryText = `${sanctuarySeeds} / ${MAX_SANCTUARY_SEEDS}`;
  const progressText = sanctuarySeeds >= MAX_SANCTUARY_SEEDS
    ? 'Prêt à fleurir'
    : `${RESCUES_PER_SEED - rescueProgress} esprit${RESCUES_PER_SEED - rescueProgress === 1 ? '' : 's'} pour une graine`;
  if (sanctuaryOutput.textContent !== sanctuaryText) sanctuaryOutput.textContent = sanctuaryText;
  if (sanctuaryProgress.textContent !== progressText) sanctuaryProgress.textContent = progressText;
  sanctuaryButton.disabled = sanctuarySeeds === 0 || gameState !== 'playing';
  sanctuaryButton.setAttribute('aria-label', sanctuarySeeds > 0
    ? `Faire éclore un refuge, ${sanctuarySeeds} graine${sanctuarySeeds > 1 ? 's' : ''} disponible${sanctuarySeeds > 1 ? 's' : ''}. Raccourci E.`
    : `Aucune graine disponible. Sauvez ${RESCUES_PER_SEED - rescueProgress} esprit${RESCUES_PER_SEED - rescueProgress === 1 ? '' : 's'} pour en gagner une.`);
  if (replayButton.textContent !== 'Rejouer') replayButton.textContent = 'Rejouer';
  const pauseButton = document.getElementById('pause-toggle');
  pauseButton.textContent = gameState === 'paused' ? 'Reprendre' : 'Pause';
  pauseButton.setAttribute('aria-label', gameState === 'paused' ? 'Reprendre la partie' : 'Mettre le jeu en pause');
  pauseButton.disabled = gameState === 'won' || gameState === 'over';
  document.getElementById('pause-overlay').hidden = gameState !== 'paused';
}
