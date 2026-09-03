# Feature Specification: Exécution de séance et historique (Lot 3)

**Feature Branch**: `002-session-execution-history`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Lot 3 : exécution de séance et historique. Lecteur de séance plein écran, un seul exercice à la fois : décompte dominant, nom de l'exercice, instructions et zones travaillées lisibles sans interaction, aperçu du suivant. Enchaînement automatique à la fin du temps imparti. Actions : pause, passer à l'exercice suivant, revenir au précédent. Signal sonore (WebAudio, jamais navigator.vibrate, non supporté iOS) à trois secondes de la fin de l'exercice courant et au changement d'exercice. Un exercice asymétrique se déroule en deux phases annoncées explicitement, côté droit puis côté gauche, chacune de la durée stockée (duration_s de session_items) ; le changement de côté est signalé comme un changement d'exercice à part entière. Écran allumé maintenu pendant toute la séance via Screen Wake Lock, relâché à la sortie de l'écran (que la séance soit terminée ou abandonnée). Persistance de la séance (table sessions) et de ses items (session_items, avec leur statut pending/done/skipped) au fur et à mesure de la progression, pas seulement à la fin. Écran de fin : durée réelle, nombre d'exercices réalisés et passés, zones travaillées ; la séance passe alors en statut completed, ce qui alimente la pondération de fraîcheur du générateur (via la vue exercise_last_performed déjà en place). Une séance quittée en cours de route reste en statut abandoned et n'alimente jamais la fraîcheur ; elle est reprenable depuis l'accueil le jour même où elle a été commencée (pas au-delà). Écran historique : liste inversée des séances passées (date, durée réelle, nombre d'exercices, zones travaillées, statut), et une vue de synthèse sur les 30 derniers jours (zones les plus et les moins travaillées, nombre de séances, volume total). Ce lot ne construit pas la génération de séance elle-même (Lot 2, déjà fait) ni la composition manuelle (Lot 4) : il consomme une séance déjà créée (peu importe sa source : générée, manuelle ou modèle) et l'exécute jusqu'à son terme ou son abandon."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exécuter une séance du début à la fin (Priority: P1)

En tant qu'utilisateur prêt à faire ma séance, je la lance et je suis guidé exercice par
exercice, décompte à l'écran, sans avoir à consulter autre chose, jusqu'à l'écran de fin.

**Why this priority**: c'est la valeur centrale du produit entier (« augmenter la
fréquence réelle des séances ») : sans exécution guidée fiable, la génération et la
banque ne servent à rien. C'est un MVP autosuffisant : une séance déjà créée (peu
importe comment) peut être exécutée de bout en bout.

**Independent Test**: peut être testé seul en démarrant une séance existante (créée
manuellement en base pour le test), en laissant chaque exercice s'écouler jusqu'à
l'enchaînement automatique, en utilisant pause / passer / revenir, et en vérifiant
l'écran de fin et le passage en statut `completed`.

**Acceptance Scenarios**:

1. **Given** une séance prête à démarrer, **When** l'utilisateur la lance, **Then** le
   premier exercice s'affiche plein écran avec un décompte dominant, son nom, ses
   instructions, les zones travaillées, et un aperçu du suivant.
2. **Given** un exercice en cours, **When** le décompte atteint trois secondes avant la
   fin, **Then** un signal sonore se déclenche.
3. **Given** un exercice en cours arrivé à zéro, **When** le temps est écoulé,
   **Then** l'exercice suivant démarre automatiquement, avec un signal sonore de
   changement.
4. **Given** un exercice en cours, **When** l'utilisateur appuie sur pause, **Then** le
   décompte s'arrête et reprend exactement où il était à la reprise.
5. **Given** un exercice en cours, **When** l'utilisateur appuie sur « passer »,
   **Then** l'exercice courant est marqué comme passé et l'exercice suivant démarre
   immédiatement.
6. **Given** un exercice qui n'est pas le premier de la séance, **When** l'utilisateur
   appuie sur « revenir », **Then** l'exercice précédent redémarre depuis son début.
7. **Given** un exercice asymétrique, **When** la première phase (côté droit) se
   termine, **Then** la phase du côté gauche démarre comme un changement d'exercice à
   part entière, annoncée explicitement, pour la même durée stockée.
8. **Given** le dernier exercice de la séance qui se termine (naturellement ou passé),
   **When** la séance n'a plus d'exercice restant, **Then** l'écran de fin s'affiche
   avec la durée réelle, le nombre d'exercices réalisés et passés, et les zones
   travaillées, et la séance passe en statut terminée.
9. **Given** une séance qui vient de passer en statut terminée, **When** l'utilisateur
   consulte ensuite un exercice qui en faisait partie, **Then** sa date de dernière
   exécution reflète cette séance.

---

### User Story 2 - Reprendre une séance quittée en cours de route (Priority: P2)

En tant qu'utilisateur qui a dû interrompre une séance (appel, imprévu), je la retrouve
et la reprends depuis l'accueil le jour même, sans repartir de zéro ni la perdre.

**Why this priority**: dépend de l'exécution de base (User Story 1) pour exister, mais
protège contre l'abandon d'usage si une interruption fait perdre la progression — un
risque réel pour la fréquence d'usage visée par le produit.

**Independent Test**: peut être testé seul en démarrant une séance, en la quittant après
un ou deux exercices sans atteindre l'écran de fin, en vérifiant qu'elle apparaît comme
reprenable depuis l'accueil le même jour, puis en la reprenant et en constatant que la
progression déjà faite est conservée.

**Acceptance Scenarios**:

1. **Given** une séance démarrée puis quittée avant l'écran de fin, **When**
   l'utilisateur revient sur l'accueil le même jour, **Then** cette séance apparaît
   comme reprenable, dans son état exact (exercices déjà faits, passés, restants).
2. **Given** une séance abandonnée reprise, **When** l'utilisateur va au bout cette
   fois, **Then** elle passe en statut terminée normalement (User Story 1).
3. **Given** une séance quittée un jour précédent sans avoir été terminée, **When**
   l'utilisateur consulte l'accueil un jour plus tard, **Then** elle n'est plus proposée
   comme reprenable.
4. **Given** une séance quittée en cours de route et jamais reprise, **When** le
   générateur (Lot 2) ou l'historique en tient compte, **Then** elle reste en statut
   abandonnée et n'alimente jamais la fraîcheur des exercices qui la composaient.

---

### User Story 3 - Consulter l'historique et la synthèse des 30 derniers jours (Priority: P3)

En tant qu'utilisateur qui veut savoir si je tiens le rythme, je consulte la liste de
mes séances passées et une synthèse de ce que j'ai travaillé récemment.

**Why this priority**: outil de suivi, utile pour rester motivé et ajuster ses
prochaines séances, mais non bloquant pour l'exécution elle-même ; vient après les deux
premières stories dans l'ordre de valeur.

**Independent Test**: peut être testé seul en consultant l'écran historique après avoir
accumulé plusieurs séances (terminées et abandonnées) sur plus de 30 jours, et en
vérifiant que la liste et la synthèse reflètent exactement les séances attendues.

**Acceptance Scenarios**:

1. **Given** plusieurs séances passées, **When** l'utilisateur ouvre l'historique,
   **Then** elles apparaissent en liste inversée (plus récente en premier), chacune avec
   sa date, sa durée réelle, son nombre d'exercices et son statut.
2. **Given** des séances réparties sur plus de 30 jours, **When** l'utilisateur consulte
   la vue de synthèse, **Then** seules les séances des 30 derniers jours entrent dans le
   calcul des zones les plus et les moins travaillées, du nombre de séances et du volume
   total.
3. **Given** aucune séance terminée dans les 30 derniers jours, **When** l'utilisateur
   consulte la synthèse, **Then** l'écran l'indique explicitement plutôt que d'afficher
   des zéros sans explication.

### Edge Cases

- L'utilisateur ferme l'onglet ou l'application sans action explicite pendant une
  séance : au retour, elle doit être retrouvée comme abandonnée si elle n'a pas été
  reprise, jamais perdue ni bloquée dans un état intermédiaire incohérent.
- « Passer » sur le dernier exercice de la séance : termine la séance, cet exercice
  compte parmi les « passés », pas parmi les « réalisés ».
- « Revenir » alors qu'on est déjà sur le premier exercice : sans effet, pas d'erreur.
- Un exercice asymétrique dont l'utilisateur passe la première phase (côté droit) :
  passe directement à la phase du côté gauche, pas à l'exercice suivant.
- Deux séances abandonnées le même jour : chacune reste indépendamment reprenable tant
  que le jour n'est pas terminé.
- L'utilisateur tente de reprendre une séance déjà terminée : ce n'est pas une action
  possible, une séance terminée ne réapparaît jamais comme reprenable.
- Rechargement de page en cours de séance (perte d'état en mémoire) : la progression
  déjà persistée (exercices déjà marqués faits/passés) n'est pas perdue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre de démarrer l'exécution guidée d'une séance
  existante, quelle que soit son origine (générée, manuelle, ou à partir d'un modèle).
- **FR-002**: Pendant l'exécution, le système DOIT afficher un seul exercice à la fois,
  en plein écran, avec un décompte dominant, le nom de l'exercice, ses instructions, les
  zones qu'il travaille, et un aperçu de l'exercice suivant, tous lisibles sans action de
  l'utilisateur.
- **FR-003**: Le système DOIT enchaîner automatiquement sur l'exercice suivant quand le
  temps imparti à l'exercice courant est écoulé.
- **FR-004**: Les utilisateurs DOIVENT pouvoir mettre en pause l'exercice en cours et le
  reprendre exactement où il s'était arrêté.
- **FR-005**: Les utilisateurs DOIVENT pouvoir passer l'exercice en cours pour enchaîner
  immédiatement sur le suivant, l'exercice passé étant marqué comme tel plutôt que comme
  réalisé.
- **FR-006**: Les utilisateurs DOIVENT pouvoir revenir à l'exercice précédent, qui
  redémarre alors depuis son début ; cette action est sans effet sur le tout premier
  exercice de la séance.
- **FR-007**: Le système DOIT émettre un signal sonore trois secondes avant la fin de
  l'exercice en cours, et un signal sonore distinct à chaque changement d'exercice, sans
  jamais recourir à une vibration de l'appareil.
- **FR-008**: Un exercice asymétrique DOIT se dérouler en deux phases distinctes, côté
  droit puis côté gauche, chacune annoncée explicitement et traitée comme un changement
  d'exercice à part entière (mêmes règles de décompte et de signal que FR-002/FR-007),
  pour la durée stockée de l'exercice.
- **FR-009**: Le système DOIT maintenir l'écran allumé pendant toute la durée de
  l'exécution, et relâcher cette contrainte dès que l'utilisateur quitte l'écran
  d'exécution, que la séance soit terminée ou abandonnée.
- **FR-010**: Le système DOIT enregistrer la progression de la séance (statut de chaque
  exercice : à faire, réalisé, passé) au fur et à mesure, pas seulement à la fin, pour
  qu'aucune progression déjà faite ne soit perdue en cas d'interruption.
- **FR-011**: Quand tous les exercices de la séance ont été traités (réalisés ou
  passés), le système DOIT afficher un écran de fin indiquant la durée réelle de la
  séance, le nombre d'exercices réalisés, le nombre d'exercices passés, et les zones
  travaillées, et DOIT faire passer la séance au statut terminée.
- **FR-012**: Une séance qui passe au statut terminée DOIT compter dans le calcul de la
  fraîcheur des exercices qu'elle contenait (date de dernière exécution).
- **FR-013**: Une séance quittée avant l'écran de fin DOIT rester au statut abandonnée
  et NE DOIT JAMAIS compter dans le calcul de fraîcheur des exercices.
- **FR-014**: Une séance abandonnée DOIT rester reprenable, avec sa progression exacte
  conservée, jusqu'à la fin du jour calendaire où elle a été commencée ; au-delà, elle
  N'EST PLUS proposée comme reprenable.
- **FR-015**: Le système DOIT proposer un écran d'historique listant les séances
  passées par ordre du plus récent au plus ancien, avec pour chacune sa date, sa durée
  réelle, son nombre d'exercices et son statut.
- **FR-016**: Le système DOIT proposer une vue de synthèse portant sur les séances
  terminées des 30 derniers jours, indiquant les zones les plus travaillées, les zones
  les moins travaillées, le nombre de séances et le volume total de temps de séance.
- **FR-017**: Quand aucune séance terminée n'existe dans la fenêtre des 30 derniers
  jours, la vue de synthèse DOIT l'indiquer explicitement plutôt que d'afficher des
  valeurs vides ou nulles sans explication.
- **FR-018**: Cette fonctionnalité NE DOIT PAS créer de séance elle-même (génération ou
  composition manuelle) : elle consomme une séance déjà existante et en gère
  l'exécution, la persistance de la progression, et l'historique qui en découle.

### Key Entities

- **Séance** (`sessions`) : une instance à exécuter, avec un statut (à faire, en cours,
  terminée, abandonnée), une source (générée, manuelle, modèle), une durée cible, une
  durée réelle (connue seulement à la fin ou à l'abandon), les zones demandées et le
  matériel disponible au moment de sa création.
- **Item de séance** (`session_items`) : un exercice au sein d'une séance, dans un
  ordre donné, avec sa durée retenue (instantané, indépendant d'une modification
  ultérieure de la banque), l'indication qu'il se déroule par côté ou non, et son statut
  (à faire, réalisé, passé).
- **Historique** (consommé, pas une nouvelle entité) : constitué de l'ensemble des
  séances déjà exécutées (terminées ou abandonnées) ; alimente à la fois l'écran
  historique et la fraîcheur consommée par le générateur (Lot 2), déjà en place.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur peut exécuter une séance de bout en bout sans consulter
  autre chose que l'écran d'exécution, du premier exercice à l'écran de fin.
- **SC-002**: Une séance interrompue puis reprise le même jour restitue exactement la
  progression déjà faite, sans perte d'un seul exercice déjà réalisé ou passé.
- **SC-003**: 100 % des séances menées jusqu'à l'écran de fin sont retrouvées avec le
  statut terminée dans l'historique, et alimentent effectivement la fraîcheur des
  exercices qu'elles contenaient.
- **SC-004**: Un utilisateur retrouve, en un seul écran, quelles zones ont été le plus
  et le moins travaillées sur les 30 derniers jours, sans calcul manuel.
- **SC-005**: Aucune séance abandonnée ne modifie la date de dernière exécution d'un
  exercice qu'elle contenait.

## Assumptions

- Cette feature s'appuie sur une séance déjà persistée en base (table `sessions` /
  `session_items`), quelle que soit la fonctionnalité qui l'a créée ; elle ne dépend
  pas de la manière dont cette séance a été composée.
- « Le jour même » pour la reprise d'une séance abandonnée s'entend comme le jour
  calendaire, dans le fuseau horaire local de l'utilisateur.
- La « durée réelle » d'une séance est le temps effectivement écoulé entre son début et
  sa fin (ou son abandon), pas la somme des durées planifiées des exercices ; elle peut
  donc différer de la durée cible demandée à la génération.
- Passer la première phase d'un exercice asymétrique enchaîne sur sa seconde phase, pas
  sur l'exercice suivant ; les deux phases sont comptées comme un seul exercice pour le
  décompte « réalisés / passés » de l'écran de fin.
- « Revenir » sur un exercice déjà marqué réalisé ou passé annule ce statut (il repasse
  à faire) puisqu'il redémarre réellement depuis son début ; le décompte final de
  l'écran de fin reflète alors ce qui s'est effectivement passé la seconde fois, pas
  l'aller précédent.
- Le générateur (Lot 2) et sa pondération de fraîcheur sont déjà en place et n'ont pas
  besoin d'être modifiés par cette feature : elle se contente d'alimenter la vue déjà
  utilisée par le générateur en faisant progresser `session_items`/`sessions` vers le
  statut terminé.
