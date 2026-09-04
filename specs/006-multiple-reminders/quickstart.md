# Quickstart — Rappels multiples

Aucune étape manuelle (pas de secret, pas de migration) : le VAPID/cron du Lot 5
restent en place tels quels.

## Valider manuellement (User Story 1, 2, 3)

```bash
npm run dev
```

1. Sur `/settings`, sans aucun rappel réglé : ajouter un premier rappel (ex. `07:00`,
   lundi à vendredi), le sauvegarder, recharger la page — il est toujours là.
2. Ajouter un second rappel (ex. `21:00`, samedi et dimanche), le sauvegarder,
   recharger — les deux rappels apparaissent, chacun avec ses propres réglages (US1).
3. Modifier l'heure du premier rappel uniquement : après sauvegarde et rechargement,
   seul le premier a changé, le second est intact (US1, FR-002).
4. Désactiver le second rappel sans le supprimer : il reste visible et réactivable
   (US1).
5. Supprimer le premier rappel : il disparaît de la liste et ne revient pas après
   rechargement, le second n'est pas affecté (US2, FR-003).
6. Sur l'accueil (`/`), avec deux rappels actifs à des horaires différents : le
   libellé affiché correspond à celui dont l'échéance est la plus proche (US3,
   FR-006). Désactiver le plus proche des deux : le libellé bascule sur l'autre.
7. Désactiver ou supprimer tous les rappels : l'accueil revient à l'invitation à
   régler un rappel, comme avant cette feature (FR-007).

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

`lib/reminders/next.test.ts` couvre la sélection du rappel le plus proche parmi
plusieurs (voir `contracts/next-reminder.md`), y compris le cas à un seul élément qui
doit se comporter exactement comme avant cette feature (FR-008, SC vérifiée par les
tests existants du Lot 5 réutilisés tels quels sur un tableau à un élément).

## Ce que cette feature ne couvre pas

Aucun changement à l'envoi réel des notifications (`supabase/functions/
send-reminders/`, `lib/reminders/due.ts`, `lib/reminders/failures.ts`) : ces modules
traitaient déjà chaque rappel actif indépendamment avant cette feature. Aucune limite
de nombre de rappels par utilisateur n'est ajoutée (voir spec § Assumptions).
