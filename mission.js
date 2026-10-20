// Progression reproductible : chaque niveau demande cinq sauvetages de plus.
const MissionProgress = (() => {
  const FIRST_LEVEL_GOAL = 10;
  const GOAL_INCREMENT = 5;

  function goalForLevel(level) {
    const safeLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
    return FIRST_LEVEL_GOAL + (safeLevel - 1) * GOAL_INCREMENT;
  }

  function rewardForLevel(level) {
    const safeLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
    return safeLevel * 25;
  }

  function create(level = 1) {
    const safeLevel = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
    return { level: safeLevel, rescued: 0 };
  }

  function restartLevel(progress, hasWon = false) {
    if (hasWon) return 1;
    return Number.isInteger(progress?.level) && progress.level >= 1 ? progress.level : 1;
  }

  function recordRescue(progress) {
    if (!progress || !Number.isInteger(progress.level) || progress.level < 1 ||
      !Number.isInteger(progress.rescued) || progress.rescued < 0) {
      throw new TypeError('Progression de mission invalide.');
    }

    const completedLevel = progress.level;
    const completedGoal = goalForLevel(completedLevel);
    progress.rescued += 1;
    if (progress.rescued < completedGoal) {
      return { completed: false, completedLevel, level: progress.level, rescued: progress.rescued, goal: completedGoal };
    }

    progress.level += 1;
    progress.rescued = 0;
    return {
      completed: true,
      completedLevel,
      level: progress.level,
      rescued: 0,
      goal: goalForLevel(progress.level),
    };
  }

  return Object.freeze({ FIRST_LEVEL_GOAL, GOAL_INCREMENT, goalForLevel, rewardForLevel, create, restartLevel, recordRescue });
})();
