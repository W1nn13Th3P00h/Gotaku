# Feature Specification: Banque d'exercices en lecture (Lot 1)

**Feature Branch**: `001-exercise-bank-browse`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Lot 1 : banque en lecture. Écran « Banque » consultant data/exercises.json déjà seedé en base : recherche texte sur le nom, filtres par zone / type / matériel (les trois seuls axes exposés dans toute l'interface). Fiche exercice en lecture seule : nom, type, zones travaillées avec la zone primaire mise en évidence, matériel requis, durée cible, instructions, contre-indications, date de dernière exécution. Tableau de couverture par zone : pour chaque zone du référentiel, le nombre d'exercices disponibles, avec mise en évidence des zones sous-alimentées. Aucune écriture dans cet écran : la banque ne se modifie que via data/exercises.json puis npm run seed. position et intensity ne sont jamais affichés ni filtrables, ce sont des champs internes au générateur. Fin de lot : la banque est consultable et le tableau de couverture montre les zones à alimenter en priorité."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrouver un exercice par recherche et filtres (Priority: P1)

En tant qu'utilisateur qui veut savoir ce qui est disponible avant une séance, je
recherche et filtre les exercices de la banque par nom, zone, type et matériel, pour
retrouver rapidement ce qui correspond à mon besoin du moment.

**Why this priority**: c'est la valeur minimale du lot : sans liste consultable et
filtrable, il n'y a pas de banque en lecture. C'est aussi le pré-requis visuel avant de
faire confiance au générateur (Lot 2).

**Independent Test**: peut être testé seul en ouvrant l'écran banque, en tapant un nom
partiel dans la recherche, puis en combinant un filtre de zone et un filtre de matériel,
et en vérifiant que seuls les exercices correspondants restent affichés.

**Acceptance Scenarios**:

1. **Given** la banque contient des exercices variés, **When** l'utilisateur saisit un
   texte correspondant à une partie du nom d'un exercice, **Then** seuls les exercices
   dont le nom contient ce texte sont affichés.
2. **Given** l'utilisateur est sur l'écran banque sans filtre actif, **When** il
   sélectionne une zone puis un type puis un matériel, **Then** la liste ne montre que
   les exercices satisfaisant les trois critères combinés.
3. **Given** une combinaison de recherche et de filtres, **When** aucun exercice ne
   correspond, **Then** l'écran l'indique explicitement plutôt que d'afficher une liste
   vide sans explication.

---

### User Story 2 - Consulter la fiche complète d'un exercice (Priority: P2)

En tant qu'utilisateur, je consulte la fiche d'un exercice pour savoir précisément
comment l'exécuter et si je peux le faire avec mon matériel et mes éventuelles
contre-indications, avant de le faire ou avant de composer une séance manuelle (Lot 4).

**Why this priority**: vient après la liste puisqu'elle en dépend, mais reste
indispensable : une liste sans détail ne permet pas de savoir comment exécuter
l'exercice.

**Independent Test**: peut être testé seul en ouvrant la fiche d'un exercice depuis la
liste et en vérifiant que tous les champs attendus sont présents et lisibles, sans aucun
contrôle d'édition visible.

**Acceptance Scenarios**:

1. **Given** un exercice sélectionné dans la liste, **When** l'utilisateur ouvre sa
   fiche, **Then** il voit le nom, le type, les zones travaillées avec la zone primaire
   mise en évidence, le matériel requis, la durée cible, les instructions et les
   contre-indications.
2. **Given** un exercice déjà réalisé par l'utilisateur, **When** il consulte sa fiche,
   **Then** la date de la dernière exécution est affichée.
3. **Given** un exercice jamais réalisé par l'utilisateur, **When** il consulte sa
   fiche, **Then** l'absence d'historique est indiquée clairement, sans erreur ni champ
   vide ambigu.
4. **Given** n'importe quelle fiche exercice, **When** l'utilisateur la consulte,
   **Then** aucune position ni intensité n'est affichée, et aucune action de
   modification ou de suppression n'est proposée.

---

### User Story 3 - Repérer les zones sous-alimentées via le tableau de couverture (Priority: P3)

En tant qu'utilisateur qui fait aussi évoluer la banque, je consulte un tableau de
couverture par zone pour savoir où concentrer l'ajout de nouveaux exercices.

**Why this priority**: outil de pilotage, utile mais non bloquant pour l'usage
quotidien de génération de séance ; vient après la consultation de base.

**Independent Test**: peut être testé seul en ouvrant le tableau de couverture et en
vérifiant que le compte affiché pour chaque zone correspond au nombre réel d'exercices
couvrant cette zone dans la banque, et que les zones les plus faibles sont visuellement
distinguées.

**Acceptance Scenarios**:

1. **Given** la banque seedée, **When** l'utilisateur ouvre le tableau de couverture,
   **Then** chaque zone du référentiel apparaît avec le nombre d'exercices qui la
   travaillent.
2. **Given** le tableau de couverture affiché, **When** une zone a un nombre
   d'exercices nettement inférieur aux autres, **Then** cette zone est mise en évidence
   comme sous-alimentée.
3. **Given** une zone du référentiel sans aucun exercice, **When** le tableau est
   affiché, **Then** cette zone apparaît tout de même, avec un compte de zéro, plutôt que
   d'être omise silencieusement.

### Edge Cases

- Recherche texte vide après avoir saisi puis effacé du texte : la liste complète
  (éventuellement filtrée par zone/type/matériel) doit réapparaître.
- Filtres combinés menant à zéro résultat : message explicite, pas de liste vide muette.
- Zone du référentiel sans aucun exercice associé : doit apparaître dans le tableau de
  couverture avec un compte de zéro, jamais être absente du tableau.
- Exercice sans contre-indication renseignée : la fiche l'indique sans laisser croire à
  une erreur de chargement.
- Recherche et filtres restent cohérents avec l'état fermé des référentiels : aucune
  valeur de zone, type ou matériel hors référentiel ne peut apparaître comme option de
  filtre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT afficher la liste de tous les exercices de la banque
  seedée en base.
- **FR-002**: Les utilisateurs DOIVENT pouvoir restreindre la liste par une recherche
  texte portant sur le nom de l'exercice.
- **FR-003**: Les utilisateurs DOIVENT pouvoir filtrer la liste par zone travaillée, par
  type d'exercice et par matériel requis, ces trois filtres étant combinables entre eux
  et avec la recherche texte.
- **FR-004**: Le système NE DOIT exposer aucun axe de filtre autre que zone, type et
  matériel.
- **FR-005**: Le système DOIT permettre d'ouvrir, pour chaque exercice de la liste, une
  fiche en lecture seule affichant : nom, type, zones travaillées avec la zone primaire
  mise en évidence, matériel requis, durée cible, instructions et contre-indications.
- **FR-006**: La fiche exercice DOIT afficher la date de la dernière exécution de cet
  exercice par l'utilisateur, ou une indication explicite d'absence d'historique si
  l'exercice n'a jamais été réalisé.
- **FR-007**: La fiche exercice NE DOIT jamais afficher la position ni l'intensité de
  l'exercice, ces champs étant internes au générateur.
- **FR-008**: Le système DOIT afficher un tableau de couverture listant, pour chaque
  zone du référentiel (y compris une zone sans aucun exercice), le nombre d'exercices
  disponibles qui la travaillent.
- **FR-009**: Le tableau de couverture DOIT mettre en évidence visuellement les zones
  dont le nombre d'exercices disponibles est faible par rapport aux autres zones.
- **FR-010**: Aucun écran de ce lot ne DOIT permettre de créer, modifier ou supprimer un
  exercice ; la seule voie de modification de la banque reste `data/exercises.json` puis
  le script de seed.
- **FR-011**: Quand une combinaison de recherche et de filtres ne retourne aucun
  exercice, le système DOIT l'indiquer explicitement à l'utilisateur.

### Key Entities

- **Exercice** : un élément de la banque, avec un nom, un type, une ou plusieurs zones
  travaillées (dont une zone primaire), un matériel requis (éventuellement aucun), une
  durée cible, des instructions et des contre-indications. Porte aussi une position et
  une intensité, internes au générateur, jamais exposées dans cette feature.
- **Zone** : une valeur du référentiel fermé de zones corporelles ; sert à la fois de
  critère de filtre sur la liste et de ligne du tableau de couverture.
- **Historique d'exécution** (consommé, pas construit ici) : permet de déterminer la
  date de dernière exécution affichée sur la fiche exercice ; peut être vide tant que le
  lot d'exécution des séances n'est pas construit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur retrouve un exercice précis dont il connaît approximativement
  le nom en moins de 10 secondes depuis l'écran banque.
- **SC-002**: Un utilisateur identifie, sans faire de calcul ni de comparaison manuelle,
  quelles zones du corps sont les moins pourvues en exercices, en un seul coup d'œil sur
  le tableau de couverture.
- **SC-003**: L'intégralité des exercices de la banque (330 au moment de ce lot) est
  consultable et affiche une fiche complète sans erreur ni champ manquant inattendu.
- **SC-004**: Un utilisateur restreint la liste à une combinaison précise de zone, de
  type et de matériel en trois interactions ou moins.
- **SC-005**: Chacune des zones du référentiel, y compris celles sans aucun exercice,
  apparaît dans le tableau de couverture.

## Assumptions

- Le Lot 0 est terminé : la banque de `data/exercises.json` est déjà seedée en base au
  moment où cette feature est utilisée ; cette feature ne touche ni au seed ni au format
  du JSON.
- Un seul utilisateur réel utilise l'application ; aucune notion de permissions
  différenciées n'est nécessaire sur cet écran.
- Le lot d'exécution des séances (Lot 3) peut ne pas encore exister : la date de
  dernière exécution est alors systématiquement absente, ce qui reste un état valide et
  attendu, pas une erreur.
- Les référentiels de zones, types et matériels utilisés pour les filtres et le tableau
  de couverture sont ceux, fermés, définis dans `docs/data-model.md`.
- « Sous-alimentée » est une mise en évidence relative (les zones les plus faibles par
  rapport aux autres), pas un seuil numérique absolu imposé par cette feature.
