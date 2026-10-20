// Audition et micro (module du jeu) : la touche C ou un clap au micro émet un appel ;
// un double clap fait éclore un refuge ; un cri émet un grand appel. Le micro est
// facultatif (réglages) : sans lui, tout reste jouable au clavier.
const clapDetector = new ClapDetector();
let activeCall = null;
let nextCallAt = 0;
let microphoneEnabled = false;

// Règle de scène : la luciole émet un son ; la perception se fait dans think() / hear().
function emitCall(loudness = 0.4, now = millis()) {
  if (gameState !== 'playing' || now < nextCallAt) return null;
  const player = targets.find(target => target.playerControlled);
  if (!player) return null;
  activeCall = new SoundCall(player.pos.x, player.pos.y, loudness, now);
  nextCallAt = now + SoundCall.COOLDOWN_MS;
  spawnRingEffect(player.pos.x, player.pos.y, [255, 236, 170], 900, activeCall.radius * 2);
  SoundEffects.play('call');
  return activeCall;
}

// appel en cours, ou null s'il est terminé
function currentCall(now = millis()) {
  if (activeCall && !activeCall.isActive(now)) activeCall = null;
  return activeCall;
}

// micro : un événement détecté par image au plus
function handleMicrophone(now) {
  if (!microphoneEnabled || !MicrophoneInput.isActive() || gameState !== 'playing') return;
  const event = clapDetector.update(MicrophoneInput.level(), now);
  if (!event) return;
  if (event.type === 'double-clap') bloomSanctuary();
  else if (event.type === 'shout') emitCall(Math.max(0.8, event.loudness), now);
  else emitCall(Math.min(1, event.loudness * 1.5), now);
}

function bindMicrophone() {
  const checkbox = document.getElementById('mic-enabled');
  const status = document.getElementById('mic-status');
  checkbox.addEventListener('change', async () => {
    if (checkbox.checked) {
      userStartAudio();
      const ok = await MicrophoneInput.start(getAudioContext());
      microphoneEnabled = ok;
      checkbox.checked = ok;
      status.textContent = ok
        ? 'Micro actif : clap = appel · double clap = refuge · cri = grand appel.'
        : 'Micro indisponible ou refusé : utilise la touche C pour appeler.';
    } else {
      MicrophoneInput.stop();
      microphoneEnabled = false;
      status.textContent = 'Micro coupé : touche C pour appeler.';
    }
  });
}
