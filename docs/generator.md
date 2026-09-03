# Générateur de séance

Module pur, dans `lib/generator/`. Aucune dépendance à React, à Supabase, à `Date.now()`
ou à `Math.random()`. Tout ce dont il a besoin lui est passé en entrée, y compris l'instant
de référence et la seed. C'est ce qui le rend testable et ce qui rend une séance
reproductible.

## Contrat

```ts
type GeneratorInput = {
  targetDurationS: number;
  zones: ZoneCode[];              // non vide
  equipment: EquipmentCode[];     // vide = sans matériel
  excludedTypes?: ExerciseType[];
  requiredTypes?: ExerciseType[]; // au moins un exercice de chacun
  maxIntensity?: 1 | 2 | 3;
  preferNeglectedZones?: boolean; // défaut false
  toleranceS?: number;            // défaut TOLERANCE_S (15) ; étape 5 uniquement
};

type GeneratorContext = {
  catalog: Exercise[];                        // exercices actifs uniquement
  lastPerformed: Map<ExerciseId, Date>;       // absent = jamais réalisé
  zoneVolume30d: Map<ZoneCode, number>;       // secondes travaillées sur 30 jours
  now: Date;
  seed: number;
};

type GeneratorResult =
  | { ok: true; items: SessionItem[]; totalDurationS: number; coverage: ZoneCoverage[] }
  | { ok: false; reason: FailureReason; detail: FailureDetail };
```

## Constantes

```
TRANSITION_S        = 10    // temps mort compté après chaque exercice
FRESHNESS_WINDOW_D  = 14    // saturation de la fraîcheur
FRESHNESS_FLOOR     = 0.1   // aucun exercice n'est jamais définitivement exclu
NEVER_DONE_BONUS    = 1.2   // léger avantage aux exercices jamais réalisés
NOISE_MIN           = 0.85
NOISE_MAX           = 1.15
ZONE_NEED_FLOOR     = 0.05  // une zone déjà servie garde un poids résiduel
TOLERANCE_S         = 15    // écart accepté sur la durée totale finale, valeur par
                             // défaut de `input.toleranceS` (voir étape 5)
TYPE_ORDER          = [massage, active_stretch, passive_stretch, muscle_activation]
POSITION_ORDER      = [standing, wall, hanging, seated, quadruped, side_lying, supine, prone]
```

`TYPE_ORDER` place le massage en ouverture, l'activation en clôture, ce qui correspond à
une séance qui précède un entraînement. C'est une constante, pas une règle en dur dans le
code, elle doit pouvoir être réordonnée en un seul endroit.

## Étape 1, filtrage

Un exercice est candidat s'il vérifie toutes les conditions suivantes :

- `active` vrai
- son matériel requis est entièrement inclus dans le matériel disponible
- au moins une de ses zones appartient aux zones demandées
- son type n'est pas dans `excludedTypes`
- son intensité est inférieure ou égale à `maxIntensity`

L'inclusion du matériel est stricte. Un exercice réclamant un élastique et un rouleau
n'est candidat que si les deux sont disponibles.

## Étape 2, coût temps

```
cost(e) = e.duration_target_s * (e.symmetry === 'asymmetric' ? 2 : 1) + TRANSITION_S
```

Le budget initial vaut `targetDurationS`. Le dernier `TRANSITION_S` d'une séance est du
temps réellement consommé entre deux exercices, il reste compté, l'écart final est absorbé
par l'ajustement de l'étape 5.

## Étape 3, pondération

Trois facteurs multiplicatifs, évalués à chaque tour de boucle.

Fraîcheur, qui casse la routine :

```
daysSince = (now - lastPerformed(e)) / 1 jour
freshness(e) = lastPerformed(e) === undefined
  ? NEVER_DONE_BONUS
  : clamp(daysSince / FRESHNESS_WINDOW_D, FRESHNESS_FLOOR, 1)
```

Besoin de zone, qui équilibre la couverture. Pour chaque zone demandée, une part cible de
budget est calculée, égale par défaut. Si `preferNeglectedZones` est vrai, les parts sont
pondérées par l'inverse du volume travaillé sur 30 jours, normalisé.

```
targetShare(z)   = part de budget visée pour z
allocatedShare(z)= budget déjà attribué aux exercices retenus dont z est une zone
deficit(z)       = max(targetShare(z) - allocatedShare(z), 0)
zoneNeed(e)      = max over z in (zones(e) ∩ Z) of deficit(z), floored at ZONE_NEED_FLOOR
```

Une zone secondaire compte autant qu'une zone primaire dans le calcul du déficit. C'est
volontaire : un exercice qui touche trois zones demandées doit être avantagé.

Bruit, pour que deux séances aux mêmes paramètres diffèrent :

```
noise = rng.uniform(NOISE_MIN, NOISE_MAX)
```

Poids final :

```
weight(e) = freshness(e) * zoneNeed(e) * noise
```

Le générateur utilisé est un PRNG déterministe seedé (mulberry32 suffit), jamais
`Math.random()`.

## Étape 4, sélection

```
selected = []
remaining = targetDurationS

# 1. satisfaire requiredTypes en priorité
for t in requiredTypes:
    pool = candidats de type t, cost <= remaining
    if pool vide: continue   # signalé dans le résultat, non bloquant
    pick = tirage pondéré(pool)
    selected.push(pick); remaining -= cost(pick); retirer pick du catalogue

# 2. remplir le budget
loop:
    pool = candidats restants avec cost(e) <= remaining
    if pool vide: break
    pick = tirage pondéré(pool)
    selected.push(pick); remaining -= cost(pick); retirer pick du catalogue
    recalculer les allocatedShare
```

Tirage pondéré : roue de la fortune sur la somme des poids, sans remise. Un exercice retenu
ne peut jamais réapparaître dans la même séance.

## Étape 5, ajustement fin de la durée

À la sortie de la boucle, `remaining` est positif et inférieur au coût du plus petit
candidat restant. C'est cet écart que l'ajustement absorbe, en jouant dans la plage
autorisée de chaque exercice retenu.

Le seuil utilisé est `input.toleranceS` si fourni, sinon `TOLERANCE_S`. C'est un champ
optionnel de `GeneratorInput` : tout appelant qui ne le fournit pas garde exactement le
comportement d'avant son introduction (rétrocompatible). Il n'agit que sur cette étape,
jamais sur la correction du budget des étapes 1 à 4.

```
tolerance = input.toleranceS ?? TOLERANCE_S

if remaining > tolerance:
    flex(i)  = (duration_max_s(i) - duration_target_s(i)) * (per_side(i) ? 2 : 1)
    total    = somme des flex
    si total > 0: répartir min(remaining, total) au prorata de flex(i),
                  arrondi à 5 secondes, sans dépasser duration_max_s
```

Le cas symétrique existe aussi. Si un ajout manuel ou un remplacement fait dépasser la
durée cible, on rétracte vers les minimums au prorata de
`duration_target_s - duration_min_s`, et seulement si cela ne suffit pas, on retire
l'exercice de plus faible poids.

Sur un exercice asymétrique, l'ajustement s'applique à la durée par côté, et pèse donc le
double dans le budget.

## Étape 6, ordonnancement

La séance reste une liste plate. L'ordre est déterministe une fois la sélection faite.

Tri par clé composite : rang du type dans `TYPE_ORDER`, puis rang de la position dans
`POSITION_ORDER`, puis intensité croissante, puis slug pour la stabilité. La position n'est
jamais exposée à l'utilisateur, elle ne sert qu'ici.

Puis une seule correction : l'exercice d'intensité la plus faible parmi les exercices
retenus est promu en première position, les autres conservant leur ordre relatif. En cas
d'égalité, le slug tranche. Cela garantit une ouverture douce sans avoir besoin d'un second
axe de tagging, l'intensité suffit.

Le regroupement par position évite de se relever entre chaque exercice. Les deux côtés d'un
exercice asymétrique sont consécutifs par construction, puisqu'un exercice asymétrique
produit un seul `session_item` avec `per_side` vrai, développé en deux phases par le
lecteur d'exécution.

## Étape 7, couverture retournée

Le résultat expose, pour chaque zone demandée, le nombre d'exercices retenus la touchant et
les secondes allouées. Deux usages : l'affichage de l'aperçu, et l'avertissement quand une
zone demandée n'a reçu aucun exercice.

## Échecs

Le générateur ne rend jamais une séance dégradée en silence. Trois motifs d'échec, chacun
accompagné du détail permettant à l'interface de proposer une sortie.

`EMPTY_CATALOG` : aucun candidat ne survit au filtrage. Le détail précise la cause
dominante, matériel ou zones, en recalculant le filtrage sans chacune des contraintes. Le
message doit dire ce qu'il faut relâcher.

`BUDGET_TOO_SMALL` : le coût du plus petit candidat dépasse le budget. Le détail donne la
durée minimale viable.

`ZONES_UNSERVABLE` : le budget ne permet pas de servir toutes les zones demandées avec au
moins un exercice. Le détail donne le nombre de zones servables et la liste des zones qui
seraient écartées. Ce n'est pas un échec bloquant si l'utilisateur accepte, l'interface
propose alors soit d'allonger la durée, soit de laisser le générateur retenir les zones les
plus délaissées de l'historique, ce qui revient à relancer avec `preferNeglectedZones` à
vrai et une liste de zones réduite.

Ordre de dégradation, jamais l'inverse : on relâche la couverture des zones avant de
relâcher le matériel. Un exercice réclamant une barre absente est inutilisable, un exercice
sur une zone voisine reste utile.

## Remplacement d'un exercice

Fonction séparée, même module. Elle reçoit la séance courante, l'index à remplacer et le
contexte. Le substitut est tiré parmi les candidats qui partagent le type de l'exercice
remplacé, partagent au moins sa zone primaire, ne figurent pas déjà dans la séance, et dont
le coût est compris dans une fenêtre de plus ou moins 15 pour cent du coût remplacé. Le
tirage réutilise la même pondération. À défaut de candidat, la contrainte de zone primaire
est élargie à l'ensemble des zones de l'exercice remplacé, puis la fenêtre de coût est
élargie à 30 pour cent. Si rien ne convient, la fonction le dit, l'interface ne propose pas
un remplacement impossible.

## Tests obligatoires

Le générateur est testé avant tout branchement à l'interface.

- déterminisme, seed identique et contexte identique donnent le même résultat exact
- variabilité, deux seeds différentes donnent des sélections différentes sur un catalogue
  suffisamment fourni
- respect du budget, durée totale dans la tolérance sur 200 générations aléatoires
- matériel, aucun exercice retenu ne réclame un matériel absent, sur 200 générations
- fraîcheur, un exercice réalisé hier est retenu significativement moins souvent qu'un
  exercice réalisé il y a un mois, sur 500 tirages
- couverture, huit zones demandées avec un budget large donnent au moins un exercice par
  zone
- `ZONES_UNSERVABLE` déclenché par huit zones sur dix minutes
- `BUDGET_TOO_SMALL` déclenché par une minute demandée
- `EMPTY_CATALOG` déclenché par une zone sans exercice disponible, avec le bon motif
  dominant
- ordonnancement, le premier exercice est d'intensité minimale parmi les retenus, et l'ordre
  relatif des suivants est conservé
- ajustement, la durée totale reste dans la tolérance et aucune durée ne sort de sa plage
