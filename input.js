// Commandes : pointeur et flèches du clavier. Elles déplacent le but de la luciole,
// jamais la luciole elle-même (qui le rejoint par arrive).

function updatePointerGoal(event) {
  keyboardControl = false;
  const bounds = sceneCanvas.elt.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * width / bounds.width;
  const y = (event.clientY - bounds.top) * height / bounds.height;
  pointerGoal = createVector(constrain(x, 0, width), constrain(y, 0, height));
  if (tutorialStage === 0 && gameState === 'playing') advanceTutorial();
}

function updateKeyboardMovement() {
  if (!keyboardControl || gameState !== 'playing') return;
  const player = targets.find(target => target.playerControlled);
  if (!player) return;
  if (!pointerGoal) pointerGoal = player.pos.copy();
  let dx = (keyIsDown(RIGHT_ARROW) ? 1 : 0) - (keyIsDown(LEFT_ARROW) ? 1 : 0);
  let dy = (keyIsDown(DOWN_ARROW) ? 1 : 0) - (keyIsDown(UP_ARROW) ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  const direction = createVector(dx, dy);
  direction.normalize();
  const frameScale = Math.min(2.5, Math.max(0.25, deltaTime / 16.667));
  const movementSpeed = Math.max(3, cursorSpeed * 2.2) * frameScale;
  pointerGoal.add(direction.mult(movementSpeed));
  pointerGoal.x = constrain(pointerGoal.x, 8, width - 8);
  pointerGoal.y = constrain(pointerGoal.y, 8, height - 8);
}
