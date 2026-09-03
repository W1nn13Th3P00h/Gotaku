# Feature Specification: Séance manuelle et modèles (Lot 4)

**Feature Branch**: `003-manual-session-templates`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Lot 4 : séance manuelle et modèles. Depuis la banque, composition manuelle d'une séance : ajout d'exercices, réordonnancement libre, ajustement de la durée de chaque exercice dans sa plage autorisée (duration_min_s à duration_max_s), durée totale calculée en continu. La composition en cours est une séance en base (sessions.status = 'draft', source = 'manual'), persistée au fur et à mesure de chaque ajout/retrait/réordonnancement/ajustement, sur le même principe que la persistance progressive du Lot 3 — pas de composition qui vit seulement en mémoire côté client. Depuis cette composition : démarrage direct (réutilise l'exécution du Lot 3, sur la séance déjà en base), ou sauvegarde comme modèle nommé et réutilisable (session_templates/template_items, déjà en base depuis le Lot 0). Liste des modèles sauvegardés, et démarrage d'un modèle : crée une nouvelle séance à partir des exercices et durées du modèle (un nouvel instantané, indépendant d'une modification ultérieure du modèle ou de la banque). Une composition vide ne peut être ni démarrée ni sauvegardée. Un exercice peut apparaître plusieurs fois dans une même composition. Ce lot ne construit ni la génération automatique (Lot 2) ni l'exécution elle-même (Lot 3, déjà faite) : il consomme l'écran banque du Lot 1 pour le choix des exercices, et remet la main au Lot 3 pour l'exécution."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Composer une séance à la main et la démarrer (Priority: P1)

En tant qu'utilisateur qui sait déjà ce qu'il veut faire aujourd'hui (plutôt que de
laisser le générateur choisir), je compose ma séance exercice par exercice depuis la
banque, j'ajuste l'ordre et les durées, et je la démarre directement.

**Why this priority**: c'est la valeur minimale du lot, autosuffisante : sans
composition + démarrage direct, la sauvegarde en modèle n'a rien à sauvegarder. C'est
aussi le chemin le plus court entre l'envie et le premier exercice quand le générateur
ne convient pas (matériel du moment, envie précise).

**Independent Test**: peut être testé seul en ajoutant plusieurs exercices depuis la
banque à une composition, en les réordonnant, en ajustant une durée, en vérifiant que
la durée totale affichée se met à jour, puis en démarrant : l'exécution du Lot 3
prend le relais sur la séance ainsi composée.

**Acceptance Scenarios**:

1. **Given** l'écran banque (Lot 1), **When** l'utilisateur ajoute un exercice à sa
   composition en cours, **Then** cet exercice apparaît dans la composition avec sa
   durée cible par défaut.
2. **Given** une composition avec plusieurs exercices, **When** l'utilisateur les
   réordonne librement, **Then** l'ordre affiché reflète immédiatement ce choix.
3. **Given** un exercice de la composition, **When** l'utilisateur ajuste sa durée à
   l'intérieur de la plage autorisée par cet exercice, **Then** la nouvelle durée est
   retenue et la durée totale de la composition se recalcule immédiatement.
4. **Given** un exercice de la composition, **When** l'utilisateur tente d'ajuster sa
   durée en dehors de sa plage autorisée, **Then** l'ajustement est refusé ou ramené à
   la borne la plus proche, jamais silencieusement accepté hors plage.
5. **Given** une composition non vide, **When** l'utilisateur retire un exercice,
   **Then** il disparaît de la composition et la durée totale se recalcule.
6. **Given** une composition non vide, **When** l'utilisateur choisit de démarrer,
   **Then** l'exécution guidée (Lot 3) démarre sur cette séance, dans l'ordre et avec
   les durées retenues dans la composition.
7. **Given** une composition vide (aucun exercice ajouté, ou tous retirés), **When**
   l'utilisateur tente de démarrer, **Then** l'action est indisponible ou refusée avec
   un message explicite.
8. **Given** un exercice déjà présent dans la composition, **When** l'utilisateur
   l'ajoute une seconde fois, **Then** il apparaît deux fois dans la composition,
   chaque occurrence ajustable indépendamment.

---

### User Story 2 - Sauvegarder une composition comme modèle réutilisable (Priority: P2)

En tant qu'utilisateur qui recompose souvent la même séance type, je la sauvegarde une
fois comme modèle nommé pour ne plus avoir à la reconstruire.

**Why this priority**: dépend d'avoir déjà composé une séance (User Story 1), et
apporte un gain de temps pour un usage répété, mais n'est pas nécessaire au premier
usage.

**Independent Test**: peut être testé seul en composant une séance, en la sauvegardant
sous un nom, et en vérifiant qu'elle apparaît ensuite dans la liste des modèles avec
exactement les mêmes exercices, ordre et durées.

**Acceptance Scenarios**:

1. **Given** une composition non vide, **When** l'utilisateur choisit de la sauvegarder
   comme modèle et saisit un nom, **Then** un modèle est créé avec cet ordre
   d'exercices et ces durées.
2. **Given** une tentative de sauvegarde, **When** l'utilisateur ne saisit aucun nom,
   **Then** la sauvegarde est refusée avec un message explicite.
3. **Given** une composition vide, **When** l'utilisateur tente de la sauvegarder comme
   modèle, **Then** l'action est indisponible ou refusée (même règle que le démarrage,
   scénario US1 #7).
4. **Given** un modèle déjà sauvegardé, **When** l'utilisateur modifie ensuite la
   composition d'origine ou la banque, **Then** le modèle sauvegardé n'est pas affecté
   par ces changements ultérieurs.

---

### User Story 3 - Démarrer une séance à partir d'un modèle sauvegardé (Priority: P3)

En tant qu'utilisateur qui a déjà un modèle prêt, je le retrouve dans ma liste de
modèles et je démarre directement une séance dessus, sans repasser par la composition.

**Why this priority**: dépend de l'existence d'au moins un modèle (User Story 2), et
apporte l'essentiel de la valeur de la fonctionnalité « modèles » (la réutilisation) ;
vient en dernier car elle n'a de sens qu'une fois qu'un modèle existe.

**Independent Test**: peut être testé seul en démarrant une séance depuis un modèle
déjà existant (créé au préalable en base pour le test) et en vérifiant que la séance
résultante reprend exactement les exercices et durées du modèle.

**Acceptance Scenarios**:

1. **Given** au moins un modèle sauvegardé, **When** l'utilisateur consulte la liste de
   ses modèles, **Then** il voit chaque modèle nommé, avec son nombre d'exercices et sa
   durée totale.
2. **Given** un modèle sauvegardé, **When** l'utilisateur choisit de le démarrer,
   **Then** une nouvelle séance est créée avec les mêmes exercices, le même ordre et
   les mêmes durées que le modèle, et l'exécution guidée (Lot 3) démarre dessus.
3. **Given** un modèle démarré, **When** l'utilisateur modifie ensuite ce modèle ou que
   la banque évolue, **Then** la séance déjà démarrée n'est jamais affectée (instantané
   indépendant, Constitution Principe IV).
4. **Given** un modèle dont un exercice a depuis été retiré de la banque active,
   **When** l'utilisateur démarre ce modèle, **Then** la séance se crée quand même avec
   cet exercice tel qu'enregistré dans le modèle (les exercices ne sont jamais
   supprimés en base, seulement désactivés).

### Edge Cases

- Composition dont tous les exercices sont retirés un par un : redevient une
  composition vide (scénario US1 #7), pas un état d'erreur.
- Ajustement de durée hors plage : refusé ou ramené à la borne, jamais une valeur
  invalide silencieusement acceptée (US1 #4).
- Sauvegarde sans nom, ou nom composé uniquement d'espaces : refusée, comme une absence
  de nom (US2 #2).
- Deux modèles portant le même nom : autorisé, aucune contrainte d'unicité sur le nom
  des modèles.
- Démarrage d'un modèle dont un exercice est devenu inactif dans la banque : la séance
  se crée quand même avec l'instantané du modèle (US3 #4) ; cet exercice ne serait
  simplement plus proposable pour une nouvelle composition ou un nouveau modèle (Lot 1
  ne liste que les exercices actifs).
- Interruption pendant la composition (fermeture d'onglet avant démarrage ou
  sauvegarde) : la composition en cours n'est pas perdue, elle reste persistée en base
  au dernier état modifié (même principe de persistance progressive que le Lot 3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre d'ajouter un exercice de la banque (Lot 1) à
  une composition de séance en cours.
- **FR-002**: Les utilisateurs DOIVENT pouvoir réordonner librement les exercices d'une
  composition en cours.
- **FR-003**: Les utilisateurs DOIVENT pouvoir retirer un exercice d'une composition en
  cours.
- **FR-004**: Les utilisateurs DOIVENT pouvoir ajuster la durée retenue pour chaque
  exercice de la composition, dans les bornes propres à cet exercice
  (`duration_min_s`/`duration_max_s`).
- **FR-005**: Le système DOIT refuser ou ramener à la borne la plus proche tout
  ajustement de durée en dehors de la plage autorisée pour l'exercice concerné.
- **FR-006**: Le système DOIT afficher la durée totale de la composition, recalculée à
  chaque ajout, retrait, réordonnancement ou ajustement de durée.
- **FR-007**: Un même exercice PEUT apparaître plusieurs fois dans une composition,
  chaque occurrence étant ajustable indépendamment des autres.
- **FR-008**: Les utilisateurs DOIVENT pouvoir démarrer directement l'exécution guidée
  (Lot 3) sur une composition non vide.
- **FR-009**: Le système NE DOIT PAS permettre de démarrer ou de sauvegarder une
  composition vide.
- **FR-010**: Les utilisateurs DOIVENT pouvoir sauvegarder une composition non vide
  comme modèle nommé, réutilisable ultérieurement.
- **FR-011**: Le système DOIT exiger un nom non vide (espaces seuls exclus) pour
  sauvegarder un modèle.
- **FR-012**: Les utilisateurs DOIVENT pouvoir consulter la liste de leurs modèles
  sauvegardés, avec pour chacun son nom, son nombre d'exercices et sa durée totale.
- **FR-013**: Les utilisateurs DOIVENT pouvoir démarrer une nouvelle séance à partir
  d'un modèle sauvegardé, avec les mêmes exercices, le même ordre et les mêmes durées
  que le modèle.
- **FR-014**: Une séance créée depuis une composition manuelle ou depuis un modèle DOIT
  figer un instantané des durées retenues au moment de sa création, indépendant de
  toute modification ultérieure de la banque, de la composition d'origine ou du
  modèle (Constitution Principe IV).
- **FR-015**: La composition en cours DOIT être persistée au fur et à mesure de chaque
  changement (ajout, retrait, réordonnancement, ajustement de durée), pour qu'aucune
  interruption avant démarrage ou sauvegarde ne la fasse perdre.
- **FR-016**: Cette fonctionnalité NE DOIT PAS dupliquer l'écran de choix des exercices
  (Lot 1) ni l'exécution guidée (Lot 3) : elle s'appuie sur l'un et remet la main à
  l'autre.

### Key Entities

- **Composition en cours** : une séance (`sessions`, `status = 'draft'`,
  `source = 'manual'`) et ses items (`session_items`), construite progressivement ;
  devient la séance exécutée dès que l'utilisateur démarre (le Lot 3 en prend alors la
  responsabilité).
- **Modèle** (`session_templates`) : un ensemble nommé et réutilisable d'exercices
  (`template_items`), chacun avec son ordre et sa durée retenue au moment de la
  sauvegarde ; indépendant de toute composition ou séance ultérieure.
- **Item de composition ou de modèle** : un exercice, sa position, sa durée retenue
  (dans la plage de l'exercice), et l'indication qu'il se déroule par côté ou non
  (hérité de la symétrie de l'exercice).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur compose une séance de plusieurs exercices et la démarre
  sans quitter le flux banque → composition → exécution.
- **SC-002**: Une composition interrompue avant d'être démarrée ou sauvegardée se
  retrouve intacte (mêmes exercices, ordre, durées) à la reprise.
- **SC-003**: Un modèle sauvegardé produit, à chaque démarrage, une séance identique à
  ce qu'il contenait au moment de la sauvegarde, y compris après des modifications
  ultérieures de la banque ou d'autres compositions.
- **SC-004**: Aucune durée hors de la plage autorisée d'un exercice ne peut se
  retrouver enregistrée dans une composition ou un modèle.

## Assumptions

- La composition en cours est modélisée comme une séance à l'état brouillon
  (`sessions.status = 'draft'`), pas comme un état purement côté client, pour la même
  raison de robustesse à l'interruption qu'au Lot 3 (FR-015).
- Aucune suppression de modèle sauvegardé n'est demandée par `docs/spec.md` pour ce
  lot ; elle n'est pas construite ici (à ne pas anticiper, comme le reste du périmètre
  hors v1).
- Aucune modification d'un modèle déjà sauvegardé (renommer, changer ses exercices)
  n'est demandée pour ce lot : un modèle se remplace en le resauvegardant sous un
  nouveau nom si besoin.
- Le choix des exercices à ajouter à une composition se fait depuis l'écran banque du
  Lot 1 (recherche, filtres, fiche) : cette feature y ajoute une action « ajouter à la
  composition », elle ne reconstruit pas un sélecteur d'exercices séparé.
- Le démarrage, qu'il vienne d'une composition manuelle ou d'un modèle, remet la main à
  l'écran d'exécution du Lot 3 (`/session/[id]`) sur la séance nouvellement prête ; cette
  feature ne construit aucun écran d'exécution.
