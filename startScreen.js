// Écran d'accueil : miniatures des lieux, choix de l'avatar, lancement de l'aventure.

// Miniatures du menu peintes avec le même moteur que le jeu : fond, décors et personnages.
function renderMenuArtwork() {
  if (typeof createGraphics !== 'function') return;
  document.querySelectorAll('[data-world-art]').forEach(element => {
    const id = element.dataset.worldArt;
    const definition = ENVIRONMENT_DEFINITIONS[id];
    if (!definition) return;
    const w = 320;
    const h = 200;
    const g = createGraphics(w, h);
    WorldBackdrop.paint(g, id, definition, w, h);
    definition.obstacles.slice(0, 4).forEach(([x, y, radius, kind]) => PropArt.draw(g, kind, x * w, y * h, radius * 0.75, 0));
    g.push(); g.translate(w * 0.4, h * 0.3); CreatureArt.drawSpirit(g, definition.spirit.kind, 11, { glow: SPIRIT_ART[definition.spirit.kind]?.glow }); g.pop();
    g.push(); g.translate(w * 0.64, h * 0.56); CreatureArt.drawGuardian(g, definition.guardian.kind, 13); g.pop();
    element.style.backgroundImage = `url(${g.elt.toDataURL('image/png')})`;
    g.remove();
  });
  document.querySelectorAll('[data-avatar-art]').forEach(element => {
    const g = createGraphics(112, 112);
    g.translate(56, 58);
    CreatureArt.drawAvatar(g, element.dataset.avatarArt, 20, { now: 0 });
    element.style.backgroundImage = `url(${g.elt.toDataURL('image/png')})`;
    g.remove();
  });
}

function showStartStep(step) {
  const startScreen = document.getElementById('start-screen');
  startScreen.dataset.step = step;
  document.getElementById('title-step').hidden = step !== 'title';
  document.getElementById('select-step').hidden = step !== 'select';
  const focusTarget = document.getElementById(step === 'title' ? 'title-play' : 'start-adventure');
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function bindStartScreen() {
  const startScreen = document.getElementById('start-screen');
  document.getElementById('title-play').addEventListener('click', () => showStartStep('select'));
  document.getElementById('select-back').addEventListener('click', () => showStartStep('title'));
  document.getElementById('title-options').addEventListener('click', () => document.getElementById('settings-toggle').click());
  document.querySelectorAll('.world-card').forEach(card => {
    card.addEventListener('click', () => {
      startSelectedWorld = card.dataset.world;
      document.querySelectorAll('.world-card').forEach(item => {
        item.classList.toggle('selected', item === card);
        item.setAttribute('aria-pressed', String(item === card));
      });
      applyEnvironment(startSelectedWorld);
    });
  });
  document.querySelectorAll('.avatar-option').forEach(option => {
    option.addEventListener('click', () => {
      selectedPlayerIcon = option.dataset.avatar;
      document.querySelectorAll('.avatar-option').forEach(item => {
        const active = item === option;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
      const player = targets.find(target => target.playerControlled);
      if (player) player.playerIcon = selectedPlayerIcon;
    });
  });
  document.getElementById('start-adventure').addEventListener('click', () => {
    applyEnvironment(startSelectedWorld);
    startScreen.classList.add('start-screen-leaving');
    window.setTimeout(() => {
      startScreen.hidden = true;
      startScreen.classList.remove('start-screen-leaving');
      document.body.classList.remove('menu-active');
      startGame(!hasCompletedTutorial());
    }, 680);
  });
}
