// État partagé de la partie : collections d'entités, réglages, compteurs et constantes.
// Chargé avant les autres modules du jeu ; aucune logique ici.

const vehicles = [];
const obstacles = [];
const sanctuaries = [];
const hideSpots = [];
const powerUps = [];
const targets = [];
// esprits sauvés qui suivent la luciole en cortège (FollowerSpirit)
const followers = [];
const visualEffects = [];
const playerTrail = [];
let sceneCanvas;
let environmentScene;
let patrolPath = [];
let motionTone;
let pointerGoal = null;
let keyboardControl = false;
let soundEnabled = false;
let soundVolume = 0.25;
let soundWasActive = false;
let targetSpeed = 1.4;
let cursorSpeed = 3.5;
let targetLimit = 5;
let spawnAnchor;
let gameState = 'ready';
let score = 0;
let rewardPoints = 0;
let rescueStreak = 0;
let savedTotal = 0;
let missionProgress = MissionProgress.create();
let levelUpTimeout = 0;
let lostSpirits = 0;
let lives = 3;
let gameElapsedMs = 0;
let gameStartedAt = 0;
let pausedAt = 0;
let playerInvulnerableUntil = 0;
let nextPowerUpAt = 0;
const POWERUP_RESPAWN_MS = 6500;
const SPEED_BOOST_MS = 6500;
const INVISIBILITY_MS = 4800;
const SHIELD_MS = 6000;
let resumeAfterSettings = false;
let lastTrailSampleAt = 0;
let evolutionManager = new EvolutionManager({ intervalMs: 30000, mutationRate: 0.12 });
let steeringDebugEnabled = false;
// Esprits neuronaux : leur fuite est dosée par un réseau de neurones (NeuralSpirit).
// Le réservoir mémorise les meilleurs cerveaux ; il est amorcé par spiritBrainPretrained.js.
let neuralSpiritsEnabled = true;
const spiritBrainPool = new SpiritBrainPool(16, 0.1);
let selectedPlayerIcon = 'firefly';
let celebrationTimeout = 0;
let startSelectedWorld = 'emerald';

const MAX_TARGETS = 50;
const MAX_LIVES = 3;
const PLAYER_INVULNERABILITY_MS = 1600;
const MAX_VISUAL_EFFECTS = 260;
const MISSION_DURATION_MS = 180000;
const RESCUES_PER_SEED = 3;
const MAX_SANCTUARY_SEEDS = 2;
const MAX_ACTIVE_SANCTUARIES = 3;
let sanctuarySeeds = 0;
let rescueProgress = 0;
let tutorialStage = -1;
const TUTORIAL_STEP_COUNT = 5;
