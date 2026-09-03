# Implementation Plan: Confort du générateur (Lot 6)

**Branch**: `005-generator-comfort` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-generator-comfort/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Quatre améliorations ciblées sur l'écran de génération déjà construit
(`app/generateur/generator-screen.tsx`, Lot 2) : des actions de relance calculées par
une nouvelle fonction pure (`lib/generator/failure-actions.ts`) à partir du détail déjà
structuré de chaque échec ; l'exposition d'une option déjà supportée par le générateur
(`preferNeglectedZones`) ; trois presets de zones supplémentaires dans
`lib/presets.ts` ; et un champ optionnel `toleranceS` sur `GeneratorInput`, décision
explicite de l'utilisateur qui touche le contrat déjà testé du module pur du Lot 2,
strictement rétrocompatible. `docs/generator.md` est mis à jour en conséquence, seule
source de vérité de l'algorithme (`CLAUDE.md`).

## Technical Context

**Language/Version**: TypeScript strict (inchangé)

**Primary Dependencies**: aucune nouvelle dépendance.

**Storage**: aucune (cette feature ne touche à aucune table).

**Testing**: Vitest. `lib/generator/generate.test.ts` (déjà le fichier des 11 tests
obligatoires) reçoit un test supplémentaire pour `toleranceS` personnalisée, sans
modifier les tests existants (rétrocompatibilité, SC-003). Un nouveau fichier
`lib/generator/failure-actions.test.ts` teste la fonction pure de suggestion de
relance, sans React ni catalogue réel.

**Target Platform**: web (inchangé).

**Project Type**: application web monolithique unique (inchangé).

**Performance Goals**: aucune exigence nouvelle ; la fonction de suggestion est pure et
immédiate.

**Constraints**: aucun appelant existant de `adjustDurations`/`generateSession` ne doit
changer de comportement s'il ne fournit pas `toleranceS` (FR-009, SC-003) — tout ajout
au contrat du générateur pur doit être un paramètre optionnel avec la constante
actuelle comme valeur par défaut.

**Scale/Scope**: un seul écran modifié (`app/generateur/`), une seule constante rendue
paramétrable, trois presets ajoutés.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principe I (générateur = module pur)** — PASS, avec vigilance particulière : le
  champ `toleranceS` ajouté à `GeneratorInput` reste optionnel, n'introduit aucune
  dépendance à React/Supabase/`Date.now()`/`Math.random()`, et les 11 tests
  obligatoires existants continuent de passer sans modification (ils n'utilisent pas
  `toleranceS`, donc héritent de la valeur par défaut).
- **Principe II (banque = source de vérité versionnée)** — N/A : aucune interaction
  avec `exercises`/`data/exercises.json`.
- **Principe III (référentiels fermés, 3 axes exposés)** — PASS : les nouveaux presets
  n'utilisent que des codes de zones déjà dans `docs/data-model.md`, aucune zone
  inventée.
- **Principe IV (historique immuable)** — N/A : aucune écriture de séance.
- **Principe V (mono-utilisateur, pas de social)** — N/A directement.
- **Méthode de travail** — `docs/generator.md` doit être mis à jour dans le même
  changement que le code (« Lis `docs/generator.md` avant d'écrire une ligne du
  générateur », `CLAUDE.md`) : la Phase 1 inclut explicitement cette mise à jour comme
  livrable de conception, pas seulement le code.

Aucune violation. Rien à documenter en Complexity Tracking — l'ajout d'un paramètre
optionnel à une fonction pure existante n'introduit aucune complexité structurelle.

## Project Structure

### Documentation (this feature)

```text
specs/005-generator-comfort/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docs/
└── generator.md                       # Mis à jour : toleranceS dans le contrat, étape 5

lib/
├── presets.ts                          # Existant (Lot 2) : +3 presets de zones
└── generator/
    ├── types.ts                        # Existant : + toleranceS?: number sur GeneratorInput
    ├── constants.ts                    # Existant : TOLERANCE_S reste la valeur par défaut
    ├── adjust.ts                       # Existant : adjustDurations(selected, remaining, toleranceS?)
    ├── generate.ts                     # Existant : passe input.toleranceS à adjustDurations
    ├── generate.test.ts                # Existant : +1 test (tolérance personnalisée respectée)
    ├── failure-actions.ts              # Nouveau : suggestRecovery (pur)
    └── failure-actions.test.ts         # Nouveau

app/
└── generateur/
    └── generator-screen.tsx            # Existant : options (preferNeglectedZones, tolérance),
                                         #   presets supplémentaires, actions sur l'écran d'échec
```

**Structure Decision**: aucun nouveau projet ni nouvelle route. Cette feature modifie
des fichiers déjà en place (Lot 2) et en ajoute deux (`failure-actions.ts` et son
test), dans la continuité de `lib/generator/` : une fonction de plus, aussi pure et
testée que le reste du module.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier.
