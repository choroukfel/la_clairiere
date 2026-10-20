// Pré-entraînement des cerveaux des esprits par neuroévolution, sans navigateur.
// Une arène réduite (tests/spiritHarness.mjs) rejoue les règles du jeu : chaque esprit
// sauvé ou attrapé dépose son ADN et sa fitness dans le réservoir, et les nouveaux
// esprits en descendent. Les meilleurs ADN sont écrits dans spiritBrainPretrained.js,
// chargé par index.html pour amorcer la partie. Une évaluation finale compare, sur
// plusieurs graines, esprits classiques, réseaux aléatoires et réseaux entraînés.
//
//   node tools/train-spirits.mjs [--minutes=60] [--seed=11] [--eval-minutes=10] [--out=fichier] [--dry-run]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadSpirits, runArena } from '../tests/spiritHarness.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const minutes = Number(args.minutes ?? 60);
const seed = Number(args.seed ?? 11);
const evalMinutes = Number(args['eval-minutes'] ?? 10);
const dryRun = args['dry-run'] === 'true';
// --out : fichier écrit (par défaut spiritBrainPretrained.js), pour comparer plusieurs candidats
const outFile = args.out ? pathToFileURL(args.out) : new URL('../spiritBrainPretrained.js', import.meta.url);

// Entraînement par tranches de 10 minutes, en changeant de graine (obstacles et
// positions différents) pour ne pas sur-apprendre une seule carte.
const env = loadSpirits({ seed });
const pool = new env.g.SpiritBrainPool(16, 0.1);
const started = Date.now();
for (let done = 0; done < minutes; done += 10) {
  const slice = loadSpirits({ seed: seed + done + 1 });
  // le réservoir est rattaché au nouveau contexte en recopiant ses ADN
  const slicePool = new slice.g.SpiritBrainPool(pool.size, pool.mutationRate);
  for (const entry of pool.entries) slicePool.add(slice.g.NeuralSteeringDNA.fromJSON(JSON.parse(JSON.stringify(entry.dna))), entry.fitness);
  const result = runArena(slice, { minutes: Math.min(10, minutes - done), pool: slicePool });
  pool.entries = slicePool.entries.map(entry => ({ dna: env.g.NeuralSteeringDNA.fromJSON(JSON.parse(JSON.stringify(entry.dna))), fitness: entry.fitness }));
  console.log(`${done + 10} min · sauvés ${result.rescued} · attrapés ${result.caught} · taux ${(result.rescueRate * 100).toFixed(1)} %`
    + ` · meilleure fitness ${pool.best()?.fitness.toFixed(1) ?? 0}`);
}
console.log(`Entraînement : ${minutes} min simulées en ${((Date.now() - started) / 1000).toFixed(1)} s`);

const entries = pool.entries.map(({ dna, fitness }) => {
  const data = JSON.parse(JSON.stringify(dna));
  const round = x => Math.round(x * 1e4) / 1e4;
  data.brain.weights = data.brain.weights.map(layer => layer.map(row => row.map(round)));
  for (const name of Object.keys(data.genes)) data.genes[name] = round(data.genes[name]);
  return { fitness: Math.round(fitness * 100) / 100, dna: data };
});

// Évaluation sur des graines jamais vues pendant l'entraînement, sans apprentissage.
const evaluate = (label, options) => {
  let rescued = 0, caught = 0;
  for (const evalSeed of [1001, 1002, 1003]) {
    const arena = loadSpirits({ seed: evalSeed });
    let evalPool = null;
    if (options.trained) {
      evalPool = new arena.g.SpiritBrainPool(16, 0.1);
      evalPool.seed({ entries });
    }
    const result = runArena(arena, { minutes: evalMinutes, neural: options.neural, pool: evalPool, learn: false });
    rescued += result.rescued;
    caught += result.caught;
  }
  const rate = rescued / Math.max(1, rescued + caught);
  console.log(`  ${label.padEnd(26)} sauvés ${String(rescued).padStart(4)} · attrapés ${String(caught).padStart(4)} · taux de sauvetage ${(rate * 100).toFixed(1)} %`);
  return rate;
};
console.log(`\nÉvaluation (3 cartes inédites × ${evalMinutes} min, sans apprentissage) :`);
const classic = evaluate('esprits classiques', { neural: false });
const random = evaluate('réseaux aléatoires', { neural: true });
const trained = evaluate('réseaux entraînés', { neural: true, trained: true });

const payload = { inputs: env.g.SPIRIT_BRAIN.inputs, outputs: env.g.SPIRIT_BRAIN.outputs, minutes, seed,
  evaluation: { classic: +classic.toFixed(3), random: +random.toFixed(3), trained: +trained.toFixed(3) }, entries };
if (dryRun) {
  console.log(`(dry-run) ${entries.length} ADN non écrits`);
} else {
  writeFileSync(outFile,
    `// Généré par tools/train-spirits.mjs (${minutes} min simulées, graine ${seed}) : ne pas modifier à la main.\n`
    + '// Meilleurs ADN d\'esprits (gènes + poids du réseau), utilisés pour amorcer le réservoir de sketch.js.\n'
    + `const PRETRAINED_SPIRIT_BRAINS = ${JSON.stringify(payload)};\n`);
  console.log(`${entries.length} ADN écrits dans spiritBrainPretrained.js`);
}
