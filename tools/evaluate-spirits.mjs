// Évaluation reproductible des esprits neuronaux, sur des cartes jamais vues à l'entraînement.
// Arène réduite de tests/spiritHarness.mjs (veilleurs, luciole scriptée qui secourt l'esprit le
// plus menacé, obstacles, refuges), sans apprentissage pendant la mesure. Quatre conditions :
//   trained  : cerveaux pré-entraînés (spiritBrainPretrained.js) ;
//   constant : les mêmes, figés à leurs poids moyens en fuite — l'esprit ne réagit plus à ce
//              qu'il perçoit (ablation : mesure ce qu'apporte la perception du réseau) ;
//   random   : mêmes gènes, réseaux aléatoires ;
//   classic  : esprits FleeTarget sans réseau.
// Résultat : taux de sauvetage par carte, moyenne ± écart-type, écrit dans EVALUATION.md.
//
//   node tools/evaluate-spirits.mjs [--maps=6] [--minutes=5] [--first-seed=1001]
import { writeFileSync } from 'node:fs';
import { loadSpirits, runArena } from '../tests/spiritHarness.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const mapCount = Number(args.maps ?? 6);
const minutes = Number(args.minutes ?? 5);
const firstSeed = Number(args['first-seed'] ?? 1001);
const seeds = Array.from({ length: mapCount }, (_, i) => firstSeed + i);

function trainedPool(env) {
  const pool = new env.g.SpiritBrainPool(16, 0.1);
  pool.seed(env.g.PRETRAINED_SPIRIT_BRAINS);
  return pool;
}

// poids moyens réellement choisis en fuite par les réseaux entraînés, sur les mêmes cartes
const sums = {};
let count = 0;
for (const seed of seeds) {
  const env = loadSpirits({ seed, pretrained: true });
  const decide = env.g.NeuralSpirit.prototype.decide;
  env.g.NeuralSpirit.prototype.decide = function (context) {
    const weights = decide.call(this, context);
    for (const [name, value] of Object.entries(weights)) sums[name] = (sums[name] ?? 0) + value;
    count++;
    return weights;
  };
  runArena(env, { minutes, pool: trainedPool(env), learn: false });
}
const mean = Object.fromEntries(Object.entries(sums).map(([name, value]) => [name, value / Math.max(1, count)]));

const conditions = {
  trained: { label: 'réseaux entraînés', run: env => runArena(env, { minutes, pool: trainedPool(env), learn: false }) },
  constant: {
    label: 'entraînés figés (poids constants)',
    run: env => {
      env.g.NeuralSpirit.prototype.decide = function (context) {
        this.senses(context); // repères perçus (luciole, refuge) toujours utilisés par fleeForces
        this.brainWeights = { ...mean };
        return this.brainWeights;
      };
      return runArena(env, { minutes, pool: trainedPool(env), learn: false });
    },
  },
  random: {
    label: 'mêmes gènes, réseaux aléatoires',
    run: env => {
      const pool = trainedPool(env);
      for (const entry of pool.entries) entry.dna.brain = new env.g.NeuralNetwork(null, env.g.NeuralSteeringDNA.sizes());
      return runArena(env, { minutes, pool, learn: false });
    },
  },
  classic: { label: 'esprits classiques (sans réseau)', run: env => runArena(env, { minutes, neural: false, learn: false }) },
};

const started = Date.now();
const rows = [];
const perMap = {};
for (const [name, condition] of Object.entries(conditions)) {
  const rates = [];
  perMap[name] = rates;
  let rescued = 0, caught = 0;
  for (const seed of seeds) {
    const result = condition.run(loadSpirits({ seed, pretrained: true }));
    rates.push(result.rescueRate * 100);
    rescued += result.rescued;
    caught += result.caught;
  }
  const m = rates.reduce((a, b) => a + b, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, rates.length - 1));
  rows.push(`| ${condition.label} | ${m.toFixed(1)} % ± ${sd.toFixed(1)} | ${Math.min(...rates).toFixed(1)} – ${Math.max(...rates).toFixed(1)} % | ${rescued} | ${caught} |`);
  console.log(rows.at(-1));
}

const table = ['| Esprits | Taux de sauvetage (moyenne ± écart-type) | Min – max par carte | Sauvés | Attrapés |', '|---|---|---|---|---|', ...rows].join('\n');

// Écarts appariés : une même carte, deux conditions ; moyenne ± erreur type des écarts.
const paired = (a, b) => {
  const d = perMap[a].map((value, i) => value - perMap[b][i]);
  const m = d.reduce((x, y) => x + y, 0) / d.length;
  const sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, d.length - 1));
  const se = sd / Math.sqrt(d.length);
  return `| ${conditions[a].label} − ${conditions[b].label} | ${m >= 0 ? '+' : ''}${m.toFixed(1)} pt ± ${se.toFixed(1)} | ${d.filter(x => x > 0).length} / ${d.length} |`;
};
const pairedTable = [
  '| Comparaison (même carte) | Écart moyen ± erreur type | Cartes où le premier gagne |', '|---|---|---|',
  paired('trained', 'constant'), paired('trained', 'random'), paired('constant', 'random'), paired('trained', 'classic'),
].join('\n');
const mapTable = [
  `| Carte | ${Object.values(conditions).map(c => c.label).join(' | ')} |`,
  `|---|${Object.keys(conditions).map(() => '---').join('|')}|`,
  ...seeds.map((seed, i) => `| ${seed} | ${Object.keys(conditions).map(name => `${perMap[name][i].toFixed(1)} %`).join(' | ')} |`),
].join('\n');
console.log(`\n${pairedTable}`);

writeFileSync(new URL('../EVALUATION.md', import.meta.url), `# Évaluation des esprits neuronaux (Clairière)

Généré par \`node tools/evaluate-spirits.mjs --maps=${mapCount} --minutes=${minutes} --first-seed=${firstSeed}\`.

${mapCount} cartes inédites (graines ${seeds[0]} à ${seeds.at(-1)}), ${minutes} min simulées chacune, dans l'arène réduite de
\`tests/spiritHarness.mjs\` : 3 veilleurs, 8 esprits, une luciole **scriptée** qui va secourir l'esprit le plus menacé,
6 obstacles, un refuge toutes les 20 s. Aucun apprentissage pendant la mesure. Avec un vrai joueur, les chiffres changent.

${table}

Écarts appariés (une même carte, deux conditions). Un écart inférieur à environ deux erreurs types n'est pas
significatif : il peut venir du hasard des parties.

${pairedTable}

Détail par carte :

${mapTable}

Poids moyens choisis en fuite par les réseaux entraînés (condition « figés ») : ${Object.entries(mean).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}.
`);
console.log(`\nÉvaluation en ${((Date.now() - started) / 60000).toFixed(1)} min — écrite dans EVALUATION.md`);
