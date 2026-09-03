# Phase 0 — Research: Séance manuelle et modèles (Lot 4)

Aucun `NEEDS CLARIFICATION` ne subsistait. Les décisions ci-dessous figent la manière de
construire ce que `docs/spec.md` (section Séance manuelle) cadre déjà, en particulier
l'articulation avec le Lot 1 (choix des exercices) et le Lot 3 (exécution, déjà
spécifié/planifié dans cette même passe).

## La composition en cours est une séance `draft`, pas un état client

- **Decision**: la composition manuelle est modélisée comme une ligne `sessions`
  (`status = 'draft'`, `source = 'manual'`) et ses `session_items`, écrite à chaque
  changement (ajout, retrait, réordonnancement, ajustement de durée), jamais accumulée
  seulement en mémoire côté client.
- **Rationale**: FR-015 exige explicitement qu'une interruption avant démarrage ou
  sauvegarde ne fasse pas perdre la composition — c'est exactement le même problème que
  la persistance progressive du Lot 3 (`research.md` de `002-session-execution-history`),
  résolu de la même façon. Modéliser la composition comme une séance permet aussi de
  démarrer directement dessus sans transformation : c'est déjà une `sessions` valide,
  il suffit d'appeler `startSession` (Lot 3).
- **Alternatives considered**: état React (`useState`) synchronisé avec `localStorage`
  — plus rapide à écrire, mais ne survit pas à un changement d'appareil et duplique une
  logique de persistance déjà résolue par le Lot 3 pour un problème identique.

## Une seule composition active à la fois

- **Decision**: `getOrCreateDraftComposition()` cherche une séance
  `status = 'draft' AND source = 'manual'` pour l'utilisateur ; si elle existe, la
  réutilise, sinon en crée une nouvelle. Un seul utilisateur ne compose donc qu'une
  seule séance manuelle à la fois.
- **Rationale**: rien dans `docs/spec.md` ne demande plusieurs compositions en
  parallèle, et l'écran décrit (« composition manuelle », singulier) suppose un flux
  linéaire. Simplifie l'accès (pas besoin de choisir « quelle » composition reprendre).
- **Alternatives considered**: plusieurs compositions nommées en parallèle — non
  demandé, aurait ajouté un écran de gestion supplémentaire pour un besoin non exprimé.

## Le statut `draft` reste hors du domaine du Lot 3

- **Decision**: `getResumableSessionsToday` et `listSessionsForHistory` (Lot 3) sont
  explicitement restreintes à `status IN ('in_progress', 'completed')` — jamais
  `draft`. Une composition en cours n'apparaît ni dans l'historique, ni dans la liste
  des séances reprenables.
- **Rationale**: une composition non démarrée n'a pas d'`started_at`, donc le calcul du
  statut effectif du Lot 3 (`isToday(started_at)`) ne s'applique pas et la
  classerait par erreur comme « abandonnée ». Ce point a été corrigé directement dans
  `002-session-execution-history/data-model.md` et son contrat, pendant la conception de
  ce lot, pour que les deux features restent cohérentes.

## Réordonnancement : boutons haut/bas, pas de glisser-déposer

- **Decision**: réordonner un exercice de la composition se fait par des boutons
  « monter »/« descendre » sur chaque ligne, pas par glisser-déposer.
- **Rationale**: aucune bibliothèque de glisser-déposer n'est présente dans le projet ;
  des boutons sont utilisables au tap sur mobile sans dépendance supplémentaire, et une
  composition compte au plus quelques dizaines d'exercices (pas besoin de réordonner en
  masse).
- **Alternatives considered**: glisser-déposer tactile — plus fluide à l'usage, mais
  ajoute une dépendance (aucune bibliothèque de ce type n'existe déjà dans le projet)
  pour un gain marginal à cette échelle.

## Ajustement de durée : clampé, jamais silencieusement hors plage

- **Decision**: une fonction pure `clampDurationS(exercise, requestedS): number` dans
  `lib/sessions/composition.ts` ramène toute valeur demandée dans
  `[duration_min_s, duration_max_s]` de l'exercice concerné ; l'écriture en base
  n'utilise jamais une valeur non clampée.
- **Rationale**: FR-005/SC-004 exigent qu'aucune durée hors plage ne puisse être
  enregistrée. Une fonction pure et testée est la façon la plus sûre de le garantir,
  quel que soit le contrôle d'interface utilisé (curseur, +/-, saisie directe).

## Sauvegarde comme modèle : copie, pas de référence

- **Decision**: `saveAsTemplate(sessionId, name)` copie les `session_items` actuels de
  la composition vers de nouveaux `template_items` d'un nouveau `session_templates` ;
  la composition (`sessions`/`session_items`) continue d'exister telle quelle après la
  sauvegarde (elle n'est pas transformée en modèle, elle en produit une copie).
- **Rationale**: US2 scénario #4 exige qu'un modèle sauvegardé ne soit plus affecté par
  une modification ultérieure de la composition d'origine — une copie l'garantit
  trivialement, une référence non.

## Démarrer depuis un modèle : nouvelle séance, instantané indépendant

- **Decision**: `startSessionFromTemplate(templateId)` crée une nouvelle `sessions`
  (`source = 'template'`), copie les `template_items` vers de nouveaux `session_items`,
  puis appelle `startSession` (Lot 3) sur cette nouvelle séance et navigue vers
  `/session/[id]`.
- **Rationale**: FR-014/US3 scénario #3 exigent l'indépendance de la séance démarrée
  vis-à-vis du modèle d'origine (Constitution Principe IV) — une copie au moment du
  démarrage, pas une référence vivante au modèle, le garantit. Réutiliser `startSession`
  du Lot 3 évite de dupliquer la logique de démarrage (FR-016).
