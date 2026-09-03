# Feature Specification: Confort du générateur (Lot 6)

**Feature Branch**: `005-generator-comfort`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Lot 6 : confort. Presets de sélection de zones supplémentaires (au-delà des 5 déjà en place), option de priorisation des zones délaissées (preferNeglectedZones, déjà un paramètre du générateur mais pas encore exposé dans l'écran de génération), affinage des messages d'échec du générateur pour les rendre actionnables plutôt que de simples explications, et réglages de tolérance (TOLERANCE_S, aujourd'hui une constante fixe du générateur, à rendre ajustable par l'utilisateur via un nouveau champ optionnel du générateur, rétrocompatible, décision explicite de l'utilisateur de ce cadrage)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rebondir sur un échec de génération sans repartir de zéro (Priority: P1)

En tant qu'utilisateur dont la génération échoue, je vois une suggestion actionnable
en un tap plutôt qu'un simple message explicatif, pour ne pas avoir à deviner quoi
changer moi-même dans le formulaire.

**Why this priority**: c'est le point de friction le plus direct pour l'objectif du
produit (« augmenter la fréquence réelle des séances ») : un échec qui se contente
d'expliquer sans agir oblige l'utilisateur à revenir en arrière et deviner quoi
changer, ce qui est exactement le type de friction que `docs/spec.md` désigne comme un
vrai défaut.

**Independent Test**: peut être testé seul en provoquant chacun des trois motifs
d'échec (budget trop petit, zones non servables, catalogue vide) et en vérifiant que
l'écran d'échec propose une action en un tap qui relance effectivement une génération
avec les critères corrigés.

**Acceptance Scenarios**:

1. **Given** un échec `ZONES_UNSERVABLE` (certaines zones demandées ne peuvent pas être
   couvertes dans la durée choisie), **When** l'utilisateur consulte l'écran d'échec,
   **Then** une action propose de continuer avec les seules zones couvrables (les zones
   non couvrables retirées de la demande), qui relance immédiatement une génération.
2. **Given** un échec `BUDGET_TOO_SMALL` (la durée choisie est inférieure au coût du
   plus petit exercice possible), **When** l'utilisateur consulte l'écran d'échec,
   **Then** une action propose directement le prochain palier de durée au moins égal à
   la durée minimale viable, et relance la génération à cette durée en un tap.
3. **Given** un échec `EMPTY_CATALOG` dont la cause dominante est le matériel,
   **When** l'utilisateur consulte l'écran d'échec, **Then** une action propose de
   relancer sans aucune contrainte de matériel.
4. **Given** un échec `EMPTY_CATALOG` dont la cause dominante est les zones,
   **When** l'utilisateur consulte l'écran d'échec, **Then** le message oriente
   explicitement vers l'élargissement des zones, sans action à tap unique disponible
   (élargir des zones précises ne peut pas être deviné automatiquement).
5. **Given** n'importe quel écran d'échec, **When** l'utilisateur préfère ajuster
   lui-même, **Then** l'option « modifier les critères » pour revenir au formulaire
   reste toujours disponible en plus de l'action suggérée.

---

### User Story 2 - Prioriser les zones délaissées depuis l'écran de génération (Priority: P2)

En tant qu'utilisateur, j'active une option pour que le générateur favorise les zones
que je travaille le moins depuis un mois, plutôt que de répartir le budget également
entre toutes les zones demandées.

**Why this priority**: le générateur sait déjà le faire (`preferNeglectedZones`,
Lot 2) ; il ne manque que l'exposer dans l'interface. Valeur réelle mais secondaire à
la gestion des échecs (User Story 1), qui touche un chemin plus fréquent.

**Independent Test**: peut être testé seul en activant l'option sur une sélection de
zones dont certaines sont nettement moins travaillées que d'autres sur les 30 derniers
jours, et en constatant que la séance générée alloue une part de budget plus grande à
ces zones qu'une génération identique sans l'option.

**Acceptance Scenarios**:

1. **Given** l'écran de génération, **When** l'utilisateur consulte les options,
   **Then** une option « prioriser les zones délaissées » est proposée, désactivée par
   défaut.
2. **Given** cette option activée, **When** l'utilisateur lance une génération,
   **Then** la séance produite favorise les zones les moins travaillées récemment parmi
   celles demandées, à budget et zones autrement identiques.
3. **Given** cette option, **When** l'utilisateur régénère ou relance après un échec,
   **Then** son état (activée ou non) est conservé jusqu'à ce qu'il la change
   explicitement.

---

### User Story 3 - Choisir parmi des presets de zones supplémentaires (Priority: P3)

En tant qu'utilisateur dont le besoin ne correspond à aucun des cinq presets déjà
proposés, je trouve un preset supplémentaire plus ciblé plutôt que de tout sélectionner
zone par zone.

**Why this priority**: gain de confort pur, indépendant du reste du lot ; les cinq
presets existants couvrent déjà les cas les plus larges, ceux-ci affinent des besoins
plus spécifiques.

**Independent Test**: peut être testé seul en ouvrant l'écran de génération et en
vérifiant que les nouveaux presets apparaissent à côté des cinq existants, et qu'un tap
sur l'un d'eux sélectionne exactement les zones qu'il annonce.

**Acceptance Scenarios**:

1. **Given** l'écran de génération, **When** l'utilisateur consulte les presets de
   zones, **Then** il voit les cinq presets existants et au moins trois nouveaux
   presets ciblés (cou et épaules, hanches et bassin, bras et avant-bras).
2. **Given** un des nouveaux presets, **When** l'utilisateur tape dessus, **Then**
   exactly les zones qu'il annonce sont sélectionnées, remplaçant la sélection
   précédente (même comportement que les presets existants).

---

### User Story 4 - Ajuster la tolérance de durée du générateur (Priority: P4)

En tant qu'utilisateur qui veut une durée totale plus précise (ou au contraire plus de
liberté sur les durées de chaque exercice), j'ajuste l'écart accepté entre la durée
générée et la durée demandée.

**Why this priority**: valeur la plus marginale des quatre (la tolérance par défaut de
15 secondes convient à l'usage courant), et la seule qui touche le contrat déjà
figé et testé du module pur du générateur (Lot 2) — la plus prudente à livrer en
dernier.

**Independent Test**: peut être testé seul en générant deux séances identiques par
ailleurs avec des tolérances différentes, et en constatant que l'écart final entre
durée obtenue et durée demandée reste dans chacune des deux tolérances choisies.

**Acceptance Scenarios**:

1. **Given** l'écran de génération, **When** l'utilisateur consulte les options,
   **Then** un réglage de tolérance est proposé, avec la valeur par défaut actuelle du
   générateur déjà sélectionnée.
2. **Given** une tolérance choisie, **When** une génération a lieu, **Then** l'écart
   entre la durée totale produite et la durée demandée ne dépasse jamais cette
   tolérance (sauf si, comme aujourd'hui, aucune marge de durée n'existe sur les
   exercices retenus pour l'absorber).
3. **Given** aucune tolérance choisie explicitement, **When** une génération a lieu,
   **Then** le comportement est strictement identique à celui d'avant ce lot (valeur
   par défaut inchangée).

### Edge Cases

- Deux motifs de suggestion actionnable en même temps (ex. `EMPTY_CATALOG` avec cause
  dominante « both ») : le message reste explicatif sans action à tap unique, comme le
  cas « zones » de User Story 1 (deviner deux relâchements à la fois n'est pas fiable).
- Action « continuer avec les zones couvrables » qui, une fois les zones non
  couvrables retirées, ne laisse plus aucune zone demandée : ce cas ne devrait pas se
  produire (`ZONES_UNSERVABLE` garantit `servableCount` zones couvrables, cf.
  `docs/generator.md`), mais l'action ne doit jamais aboutir à un formulaire sans zone.
- Action « prochain palier de durée » quand la durée minimale viable dépasse le plus
  grand preset de durée disponible : proposer tout de même cette durée précise plutôt
  que de ne rien proposer.
- Tolérance réglée à une valeur très élevée : ne change rien à la correction du
  budget (étapes 1 à 4 de `docs/generator.md`), seulement à l'étape d'ajustement fin
  (étape 5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sur un échec `ZONES_UNSERVABLE`, le système DOIT proposer une action qui
  relance la génération avec les zones non couvrables retirées de la demande.
- **FR-002**: Sur un échec `BUDGET_TOO_SMALL`, le système DOIT proposer une action qui
  relance la génération à la plus petite durée proposée par ailleurs qui soit au moins
  égale à la durée minimale viable indiquée par l'échec.
- **FR-003**: Sur un échec `EMPTY_CATALOG` dont la cause dominante est le matériel (ou
  les deux), le système DOIT proposer une action qui relance la génération sans aucune
  contrainte de matériel.
- **FR-004**: Sur un échec `EMPTY_CATALOG` dont la cause dominante est les zones, le
  système NE DOIT PAS proposer d'action à tap unique inventée automatiquement.
- **FR-005**: Chaque écran d'échec DOIT toujours conserver la possibilité de revenir
  modifier les critères manuellement, en plus de toute action suggérée.
- **FR-006**: L'écran de génération DOIT proposer une option pour prioriser les zones
  délaissées, désactivée par défaut, qui active le paramètre déjà existant du
  générateur prévu à cet effet.
- **FR-007**: L'écran de génération DOIT proposer, au-delà des cinq presets de zones
  déjà existants, au moins trois presets supplémentaires, chacun sélectionnant un
  ensemble de zones cohérent en un tap.
- **FR-008**: L'écran de génération DOIT proposer un réglage de la tolérance de durée
  du générateur, dont la valeur par défaut est celle déjà utilisée par le générateur
  avant ce lot.
- **FR-009**: Le générateur DOIT accepter une tolérance personnalisée en paramètre
  optionnel, sans changer son comportement pour tout appelant qui ne la fournit pas.

### Key Entities

- **Suggestion d'échec** : une action rattachée à un motif d'échec précis du
  générateur, qui reformule les nouveaux critères de relance à partir du détail de
  l'échec (zones retenues, durée minimale, matériel), sans jamais inventer de valeur
  hors de ce que le détail de l'échec fournit déjà.
- **Preset de zones** : une entrée d'interface (déjà définie comme telle, pas une
  entité en base) associant un libellé à une liste de zones du référentiel.
- **Tolérance de durée** : un paramètre optionnel du générateur, en secondes, agissant
  uniquement sur l'étape d'ajustement fin de la durée totale.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Face à un échec `ZONES_UNSERVABLE` ou `BUDGET_TOO_SMALL`, un utilisateur
  obtient une séance en un seul tap supplémentaire, sans revenir modifier le formulaire
  à la main.
- **SC-002**: Une génération avec la priorisation des zones délaissées activée alloue,
  sur une sélection de zones à fraîcheur inégale, une part de budget mesurablement plus
  grande aux zones les moins travaillées qu'une génération identique sans cette option.
- **SC-003**: Aucune génération existante (sans tolérance personnalisée) ne change de
  comportement après ce lot.
- **SC-004**: Un utilisateur trouve un preset correspondant à un besoin ciblé (cou et
  épaules, hanches, bras) sans sélectionner de zone individuellement.

## Assumptions

- Les libellés et compositions exactes des presets supplémentaires (cou et épaules,
  hanches et bassin, bras et avant-bras) sont un choix d'interface raisonnable, pas une
  exigence produit figée ailleurs : `docs/spec.md` ne les nomme pas, seul le roadmap
  demande « des presets supplémentaires ». Comme les presets existants, ce sont de
  simples constantes d'interface, ajustables sans conséquence sur le générateur ou la
  base.
- Rendre `TOLERANCE_S` ajustable se fait par un champ optionnel du générateur pur
  (Lot 2), avec la constante actuelle comme valeur par défaut — décision explicite de
  l'utilisateur pour ce lot, qui touche le contrat déjà testé du module pur, à la
  différence des trois autres stories qui ne touchent que la couche interface.
- L'action suggérée sur `EMPTY_CATALOG` ne s'applique que si la cause dominante est le
  matériel (ou les deux causes à égalité) : relâcher des zones précises ne peut pas se
  déduire automatiquement sans deviner lesquelles, donc aucune action à tap unique
  n'est inventée pour ce cas (FR-004).
