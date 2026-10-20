import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../mission.js', import.meta.url), 'utf8'), context, { filename: 'mission.js' });
const { MissionProgress } = vm.runInContext('({ MissionProgress })', context);

test('la première mission demande 10 sauvetages et passe ensuite au niveau 2 à 15', () => {
  const progress = MissionProgress.create();
  assert.equal(MissionProgress.goalForLevel(progress.level), 10);
  for (let rescue = 1; rescue <= 9; rescue++) {
    const result = MissionProgress.recordRescue(progress);
    assert.equal(result.completed, false);
    assert.equal(progress.rescued, rescue);
  }

  const transition = MissionProgress.recordRescue(progress);
  assert.equal(transition.completed, true);
  assert.equal(transition.completedLevel, 1);
  assert.equal(progress.level, 2);
  assert.equal(progress.rescued, 0);
  assert.equal(transition.goal, 15);
});

test('la progression continue avec 20 sauvetages au niveau 3 et repart au niveau 1 sur une nouvelle partie', () => {
  const progress = MissionProgress.create();
  for (let rescue = 0; rescue < 10; rescue++) MissionProgress.recordRescue(progress);
  assert.equal(MissionProgress.goalForLevel(progress.level), 15);
  for (let rescue = 0; rescue < 15; rescue++) MissionProgress.recordRescue(progress);
  assert.equal(progress.level, 3);
  assert.equal(progress.rescued, 0);
  assert.equal(MissionProgress.goalForLevel(progress.level), 20);

  const nextRun = MissionProgress.create();
  assert.equal(nextRun.level, 1);
  assert.equal(MissionProgress.goalForLevel(nextRun.level), 10);
});

test('une défaite permet de reprendre le dernier niveau atteint avec une jauge vide', () => {
  const progress = MissionProgress.create(3);
  progress.rescued = 7;

  const retry = MissionProgress.create(MissionProgress.restartLevel(progress));
  assert.equal(retry.level, 3);
  assert.equal(retry.rescued, 0);
  assert.equal(MissionProgress.goalForLevel(retry.level), 20);
  assert.equal(MissionProgress.restartLevel(progress, true), 1);
});

test('les niveaux invalides retombent sur le premier objectif', () => {
  assert.equal(MissionProgress.goalForLevel(0), 10);
  assert.equal(MissionProgress.goalForLevel('pas un niveau'), 10);
  assert.throws(() => MissionProgress.recordRescue({ level: 0, rescued: 0 }), /Progression de mission invalide/);
});

test('les récompenses augmentent progressivement à chaque niveau', () => {
  assert.equal(MissionProgress.rewardForLevel(1), 25);
  assert.equal(MissionProgress.rewardForLevel(2), 50);
  assert.equal(MissionProgress.rewardForLevel(5), 125);
  assert.equal(MissionProgress.rewardForLevel(0), 25);
});
