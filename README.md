# La Clairière — aventure de steering behaviors

Ouvre `index.html` dans un navigateur, ou sers le dossier avec un serveur HTTP local (`npx serve .`, nécessaire pour le micro). Le tutoriel accompagne la première partie.

## Mission

Guide la créature lumineuse avec les flèches du clavier ou la souris, et accomplis la mission avant l’aube. Le niveau 1 demande **10 sauvetages**, le niveau 2 en demande **15**, le niveau 3 en demande **20**, puis chaque niveau ajoute cinq créatures. Chaque niveau accorde un nouveau compte à rebours de trois minutes ; la jauge repart à zéro, tandis que le score et les graines restent acquis. Trois collisions avec les veilleurs terminent aussi la partie.

Chaque décor comporte des obstacles que les agents contournent et trois cachettes repérables par un anneau vert : entrer dans une cachette masque la luciole aux veilleurs. Des bonus apparaissent régulièrement : ⚡ vitesse × 1,7 pendant 6,5 s, ◉ invisibilité pendant 4,8 s, ✦ bouclier pendant 6 s, ou + une énergie.

Les esprits sauvages errent en groupe et fuient les veilleurs. Après deux secondes de poursuite continue, ils se dédoublent. Tous les trois sauvetages, tu gagnes une graine (deux au plus) : **E** ou le bouton **Refuge** fait éclore une zone protectrice pendant huit secondes.

## Commandes

| Action | Commande |
|---|---|
| Guider la luciole | souris ou flèches (elle rejoint le but par **arrive**) |
| Refuge | **E** ou le bouton *Refuge* (une graine) |
| Appeler les esprits | **C**, ou un clap au micro : les esprits qui entendent accourent… et les veilleurs aussi |
| Micro (facultatif) | réglages : clap = appel, double clap = refuge, cri = grand appel |
| Pause / reprise | **P** / **Échap** |
| Vecteurs de pilotage | réglages : *Visualiser les vecteurs de pilotage* |
| Téléphone | toucher ou glisser le doigt place le but ; boutons **Appel**, **Refuge**, **Pause** ; interface compacte en portrait et en paysage |

## Tous les points du cours, et où les voir

| Exemple du cours | Dans le jeu | Fichiers |
|---|---|---|
| **1 · Seek / Flee** | les veilleurs patrouillent et foncent ; la fuite de Reynolds (vitesse désirée opposée à la menace) | `steeringBehaviors.js` (`seek`, `flee`) |
| **1 · Fuite avec endurance** (scénario) | rayon de déclenchement ≠ distance de sécurité, sprint, endurance, épuisement, réarmement seulement en sécurité ; barre d’endurance sous l’esprit | `spiritEscape.js`, `fleeTarget.js` |
| **2 · Pursue / Evade** | les veilleurs anticipent leur cible ; les esprits évitent la position future du veilleur | `steeringBehaviors.js` (`pursue`, `evade`) |
| **2 · Poursuite parfaite** (correction) | le lynx et la baudroie visent le **point d’interception exact** (résolution de \|D + V t\| = s t) | `steeringBehaviors.js` (`interceptPoint`, `pursuePerfect`), `seekVehicle.js` |
| **3 · Arrive** | la luciole ralentit sur le curseur ; un esprit appelé arrive vers elle | `steeringBehaviors.js` (`arrive`) |
| **3 · Arrive avec décalage** (correction) | le **cortège** : les esprits sauvés suivent la luciole en file, chacun à distance fixe du précédent | `followerSpirit.js` |
| **4 · Wander** | errance des esprits, des veilleurs sans cible et du décor animé | `steeringBehaviors.js` (`wander`) |
| **5-1 · Projection scalaire** | évitement d’obstacle, suivi de route, et **ligne de vue** (un obstacle cache-t-il la cible ?) | `steeringBehaviors.js` (`projectOnSegment`, `lineOfSight`) |
| **5-2 / 5-3 · Path following** | chaque veilleur suit la route de patrouille de son décor | `steeringBehaviors.js` (`followPath`), `seekVehicle.js` |
| **6 · Obstacle avoidance** | tous les agents contournent rochers, arbres et cristaux | `steeringBehaviors.js` (`avoidObstacle`) |
| **7 · Boids** | les esprits errent en groupe : séparation, alignement, cohésion | `steeringBehaviors.js` (`separate`, `align`, `cohesion`) |
| **8 · Évolution des comportements** | les poids de fuite, de séparation, de cohésion et la perception sont des gènes ; sélection périodique | `evolution.js` (`SteeringDNA`, `EvolutionManager`) |
| **9 / 9b · Réseau de neurones + capteurs à rayons** | chaque esprit neuronal porte trois capteurs à rayons (devant, 45° à gauche et à droite) qui mesurent le premier obstacle ou veilleur ; avec ses autres perceptions, ils nourrissent un réseau de neurones dont les poids évoluent | `sensorRay.js`, `neuralSpirit.js`, `neuralSteeringDNA.js` |
| **10 · Missiles génétiques** | les **feux follets migrateurs** : 18 feux follets à ADN de trajectoire (une force par image) traversent la carte jusqu’au nid ; à chaque vol, les meilleurs sont sélectionnés, croisés et mutés, et on les voit apprendre à contourner obstacles et veilleurs | `migratingWisp.js` (sous-classe de `GeneticRocket`), `wispNest.js`, `wispMigration.js`, `evolution.js` (`TrajectoryDNA`, `GeneticPopulation`) |
| **Reynolds : hide** | un esprit en fuite peut se cacher derrière un obstacle, du côté opposé au veilleur | `steeringBehaviors.js` (`hidingSpot`, `hide`) |
| **Reynolds : leader following / offset pursuit** | le cortège vise un point derrière la position **future** de son meneur, et laisse libre la route devant lui | `followerSpirit.js` |

## Nouveautés de cette version

- **Fuite réglementée** : un esprit fuit quand un veilleur entre dans son rayon de perception et continue jusqu’à la distance de sécurité (rayon + 70 px), même hors du cercle. Une endurance pleine dure 3,5 s ; à l’épuisement, ses limites normales sont restaurées exactement, il devient vulnérable (« zZ ») et ne peut refuir qu’une fois en sécurité. L’endurance se recharge au calme. Changer de lieu ou de niveau remet la fuite à zéro sans recréer la population.
- **Perception par ligne de vue** : un veilleur ne voit plus une cible cachée derrière un obstacle ; il va enquêter à sa dernière position connue.
- **Se cacher** : nouvelle option des esprits neuronaux, qui peuvent rejoindre la cachette la plus proche derrière un obstacle.
- **Appel et audition** : touche C ou micro. Le rayon d’audition grandit avec le volume. Les esprits qui l’entendent rejoignent la luciole ; les veilleurs qui l’entendent viennent enquêter. C’est un risque à doser.
- **Cortège** des esprits sauvés : leader following, arrive avec décalage, séparation. Ils s’envolent au bout de six secondes.
- **Poursuite parfaite** pour le lynx et la baudroie.
- **Feux follets migrateurs** (exemple 10 dans le jeu) : un vol dure 10 s ; toucher un obstacle, un veilleur ou le bord l’arrête. Fitness = proximité du nid, fortement bonifiée à l’arrivée, pénalisée en cas de collision ; sélection proportionnelle, croisement, mutation (0,8 % des gènes) et élitisme. Chaque arrivée rapporte un éclat. Mesuré sur les six cartes : premières arrivées entre la génération 6 et 18, puis 7 à 14 feux follets sur 18 au nid vers la génération 40-50. L’ADN appris est gardé d’un niveau à l’autre. Statut dans le panneau de mission ; case *Feux follets migrateurs* dans les réglages.
- **Capteurs à rayons** (exemple 9 dans le jeu) : les esprits neuronaux « voient » devant eux pendant la fuite ; les rayons sont tracés en mode debug.
- **Sons** synthétisés (Web Audio) : sauvetage, capture, esprit perdu, duplication, refuge, bonus, niveau, appel. Ils respectent la case *Ambiance sonore* et le volume.

## Architecture et méthodes du cours

- **`vehicle.js` est exactement celui de `1-Seek`** (code fourni, non modifié ; un test vérifie son empreinte). La fuite de Reynolds vit dans `SteeringBehaviors.flee()`, le freinage dans `SteeringBehaviors.brake()`.
- **Trois niveaux de Reynolds séparés** : `think(ships, now, context)` (perception, fuite réglementée, choix du mode guidé / fuite / appelé / errance / duplication), `steer(context)` (forces, `applyForce`), puis `update()` et `edges()` hérités, appelés **une seule fois par image** par `sceneController.js` après le steering de toutes les cibles. Les veilleurs suivent le même découpage (`hear`, `chooseBehaviorTarget`, `applyBehaviors`, `update`).
- **Aucune vitesse modifiée à la main** : arrêt pendant une duplication par freinage, frottement des confettis par traînée, vitesse nulle imposée par la locomotion. Les seules écritures directes de position sont des **règles de scène** explicites : réapparition de la luciole capturée, entité dégagée d’un nouvel obstacle, bornes après redimensionnement, bouclage du décor, réapparition des veilleurs, vitesse de départ d’un esprit qui vient de naître.
- **Un fichier par entité** (toutes héritent de `Vehicle`) : `fleeTarget.js`, `neuralSpirit.js`, `followerSpirit.js`, `seekVehicle.js`, `obstacle.js`, `sanctuary.js`, `powerUp.js`, `hideSpot.js`, `environmentElement.js`, `sceneParticle.js`, `sceneRing.js`, `sceneLabel.js`, `geneticRocket.js`, `migratingWisp.js`, `wispNest.js`.
- **Modèles et perceptions** (pas des entités) : `evolution.js` (ADN, gestionnaires, populations, réseau), `neuralSteeringDNA.js`, `spiritBrainPool.js`, `spiritEscape.js`, `sensorRay.js`, `soundCall.js`, `clapDetector.js`.
- **Le jeu** (ancien `sketch.js` de 1 266 lignes, découpé par responsabilité) : `gameState.js` (état), `startScreen.js`, `worldSetup.js` (règles de scène), `missionFlow.js`, `gameHud.js`, `sceneController.js` (think → steer → update), `hearing.js` (appel et micro), `effects.js`, `input.js`, `debugView.js`, et `sketch.js` (`setup`, `draw`). Migration : `wispMigration.js` (contrôleur de l’algorithme génétique).
- **Rendu** : `paperArt.js`, `worldBackdrop.js`, `propArt.js`, `creatureArt.js`, `soundEffects.js`, `microphone.js`.

## Esprits à réseau de neurones

Les esprits sauvages sont des `NeuralSpirit` (sous-classe de `FleeTarget`). Pendant une fuite, un **réseau de neurones** choisit le dosage des comportements. Il ne déplace rien lui-même : il remplace seulement la **sélection de l’action**.

1. **Perception → réseau** (`think` → `decide`) : 15 entrées normalisées — proximité du veilleur et vitesse de rapprochement, proximité de la luciole et son côté par rapport au veilleur, idem pour un refuge, voisins proches, obstacle le plus proche, vitesse, **endurance**, proximité de la meilleure **cachette**, « suis-je **caché** du veilleur ? », et trois **capteurs à rayons**. Réseau 15 → 8 → 5 (classe `NeuralNetwork` d’`evolution.js`).
2. **Steering** (`steer` → `fleeForces`) : les 5 sorties pondèrent `evade`, la séparation, `seek` vers la luciole, `arrive` vers un refuge et `arrive` vers la cachette, combinés avec l’évitement d’obstacles par `SteeringBehaviors.combine`, qui borne la force à `maxForce`.
3. **Locomotion** : `Vehicle.update()`, inchangée.

**Neuroévolution** (pas de rétropropagation) : `NeuralSteeringDNA` = gènes de `SteeringDNA` + poids du réseau. Chaque esprit sauvé ou attrapé dépose son ADN dans `SpiritBrainPool`, avec fitness = secondes de fuite survécues + 10 s s’il a été sauvé. Les nouveaux esprits naissent d’un croisement (tournoi) puis d’une mutation. Les anciens scores s’atténuent (× 0,97 par ajout). `spiritBrainPretrained.js` amorce le réservoir ; il est produit sans navigateur par une arène qui rejoue les règles du jeu :

```bash
node tools/train-spirits.mjs --minutes=60 --seed=11   # entraînement (environ une minute)
node tools/evaluate-spirits.mjs --maps=6 --minutes=5   # évaluation → EVALUATION.md
```

**Évaluation** (détail par carte dans [`EVALUATION.md`](EVALUATION.md)) : 6 cartes jamais vues pendant l’entraînement, 5 min chacune, sans apprentissage pendant la mesure. La condition « figés » garde les cerveaux et les gènes entraînés mais remplace la décision du réseau par ses poids moyens : l’esprit ne réagit plus à la situation (ablation).

| Esprits | Taux de sauvetage (moyenne ± écart-type) |
|---|---|
| classiques (`FleeTarget`, sans réseau) | 53,9 % ± 1,6 |
| mêmes gènes, réseaux aléatoires | 68,1 % ± 1,7 |
| entraînés figés à leurs poids moyens | 73,6 % ± 2,3 |
| réseaux entraînés | **71,0 % ± 5,9** |

| Comparaison sur une même carte | Écart ± erreur type | Cartes gagnées |
|---|---|---|
| entraînés − classiques | **+17,1 pt ± 2,2** | 6 / 6 |
| figés − réseaux aléatoires | +5,5 pt ± 0,5 | 6 / 6 |
| entraînés − réseaux aléatoires | +2,8 pt ± 2,4 | 5 / 6 |
| entraînés − figés | −2,6 pt ± 2,3 | 1 / 6 |

**Ce que ces chiffres montrent, honnêtement** : les esprits neuronaux sauvent 17 points de plus que les esprits classiques, sur toutes les cartes. Ce gain vient des comportements qu’ils ont en plus (se cacher, rejoindre la luciole ou un refuge) et de ce que l’évolution a appris : de **bons poids moyens** — fuir fort (3,2), rejoindre le refuge (3,0), la luciole (2,8) et la cachette (2,8) — qui battent nettement des réseaux aléatoires. La réaction du réseau **au cas par cas** n’apporte pas de gain mesurable (−2,6 ± 2,3 point, dans le bruit).

**Fiabilité de l’entraînement** : avec 15 entrées, l’entraînement est très sensible au hasard. Sur six candidats (trois graines, 60 et 150 min), un seul battait des réseaux aléatoires sur des cartes de **validation** (2001 à 2003), et entraîner plus longtemps n’aidait pas. Le cerveau installé est ce meilleur candidat (graine 11, 60 min) ; les chiffres ci-dessus sont mesurés ensuite, sur des cartes d’**évaluation** distinctes (1001 à 1006), pour que ce choix ne fausse pas la mesure. Ces mesures viennent d’une arène simplifiée, avec une luciole scriptée : avec un vrai joueur, elles peuvent changer.

```bash
node tools/train-spirits.mjs --minutes=60 --seed=11   # cerveau installé
```

**Réglages** : la case *Esprits à réseau de neurones* s’applique aux prochaines naissances. En mode *Visualiser les vecteurs de pilotage*, des barres au-dessus des esprits en fuite montrent les poids choisis (rouge : évitement, bleu : séparation, jaune : vers la luciole, vert : vers le refuge, violet : se cacher), et les cercles de déclenchement (blanc, rouge s’il est franchi) et de sécurité (vert) sont tracés.

## Tests

```bash
node --test tests/*.test.mjs
```

**97 tests**. Ils chargent les vrais fichiers du jeu dans un contexte `vm`, avec un aléatoire reproductible et une horloge simulée (`tests/spiritHarness.mjs`). Ils couvrent les comportements (fuite de Reynolds, freinage, poursuite parfaite, cachette, ligne de vue), la fuite réglementée (seuils inclusifs, veilleur le plus proche, durée exacte, endurance, épuisement, réarmement, transition de scénario), les trois niveaux think / steer / update, la duplication sans téléportation, l’appel (rayon, durée, esprits, veilleurs), le micro (clap, double clap, cri, bruit ambiant), le cortège, les sons, le pilotage tactile, les capteurs à rayons, les feux follets migrateurs (population générique, capture par un veilleur, récompense unique, changement de décor sans perte d’ADN, apprentissage réel autour d’un mur de rochers), le réseau et son ADN, le réservoir, l’arène, les cerveaux pré-entraînés, et la conformité : `vehicle.js` identique au cours, une entité par fichier, aucune vitesse modifiée à la main, aucun timer permanent.

Le jeu est aussi validé dans un vrai Chrome avec p5.js : accueil, partie, feux follets migrateurs, capteurs à rayons, appel, cortège, poursuite parfaite, debug, réglages, aucune erreur JavaScript.

## Nouveautés de progression

- **Veilleurs adaptatifs** : ils patrouillent, poursuivent les esprits repérés et enquêtent sur la dernière position connue d’une cible cachée, invisible ou entendue. Leur portée et leur vitesse augmentent avec les niveaux.
- **Récompenses** : éclats magiques par sauvetage, combo tous les trois sauvetages, récompense de niveau et une énergie si la jauge n’est pas pleine.
- **Cartes évolutives** : chaque niveau renouvelle le décor et ajoute des obstacles thématiques.

## Retouche visuelle et locomotion

Les rayons colorés et les poussières lumineuses dérivent en continu, la brume suit la teinte du décor, la luciole et les esprits flottent et s’étirent selon leur vitesse. Les veilleurs ont des signatures de déplacement distinctes : le requin ondule et intercepte, la mante alterne accélérations et zigzags d’embuscade, le chat passe d’une approche lente à des bonds d’interception, le gardien mécanique avance par pulsations, le golem progresse lentement avec un évitement large, la mite garde un vol souple.

## Écran de lancement et personnalisation

Un écran animé permet de choisir l’un des six lieux, puis l’apparence de la luciole (luciole, papillon, étoile, lune, cristal ou feuille). Chaque niveau débloqué affiche une célébration animée.

## Direction artistique : diorama de papier découpé

Le monde est un diorama de papier vu de dessus : sol au grain de papier, collines en couches découpées avec ombre portée, et un relief propre à chaque lieu. Créatures, veilleurs et décors sont des figurines de papier (liseré blanc, ombre décalée, tri en profondeur selon `y`). Tout est dessiné par le code : aucune image n’est chargée.

| Lieu | Relief | Esprits à sauver | Veilleur (mode de déplacement) | Cachette |
| --- | --- | --- | --- | --- |
| Forêt de l'Émeraude | rivière | abeilles | Rôdeur des ronces (pulsations) | fougères |
| Montagne de Glace | lac gelé | renards | Lynx de givre (approche puis interception) | igloo |
| Désert d'Or | oasis | lapins | Scorpion des dunes (zigzag d'embuscade) | tente |
| Île Volcanique | coulée de lave | braises | Phalène de cendre (vol souple) | grotte |
| Cité des Nuages | courants de vent | oiseaux | Raie d'orage (vol souple) | nid de nuages |
| Océan Profond | chenal de sable | poissons | Baudroie-lanterne (nage et interception) | anémone |
