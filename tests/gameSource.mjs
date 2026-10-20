// Modules du jeu (ex-sketch.js découpé), dans l'ordre de chargement d'index.html.
import { readFileSync } from 'node:fs';

export const GAME_MODULES = ['gameState.js', 'startScreen.js', 'worldSetup.js', 'missionFlow.js', 'gameHud.js',
  'sceneController.js', 'hearing.js', 'effects.js', 'input.js', 'debugView.js', 'sketch.js'];

// Source concaténée de tous les modules du jeu.
export function gameSource() {
  return GAME_MODULES.map(file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
}
