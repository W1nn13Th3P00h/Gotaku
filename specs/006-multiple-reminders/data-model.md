# Phase 1 — Data Model: Rappels multiples

Aucune nouvelle table, aucune migration. `reminders` (posée au Lot 0, exploitée au Lot
5, voir `docs/data-model.md`) n'a jamais eu de contrainte d'unicité sur `user_id` —
seule l'application se comportait comme si elle en avait une.

## Reminder (lecture/écriture, `reminders`)

| Champ       | Type                 | Contrainte                                          |
|-------------|----------------------|------------------------------------------------------|
| `id`        | uuid                 | généré par la base, identifie un rappel individuel   |
| `userId`    | uuid                 | RLS `reminders_own` : toujours l'utilisateur courant  |
| `timeLocal` | string `HH:MM`       | requis                                                |
| `weekdays`  | `number[]` (1–7)     | non vide si `active` (FR-004, inchangé du Lot 5)      |
| `timezone`  | string IANA          | requis                                                |
| `active`    | boolean              | requis                                                |

Ce qui change avec cette feature : **la relation `user` → `reminders` passe de 0..1 à
0..N côté application**, pour correspondre à ce que le schéma permettait déjà. Aucun
champ, aucune contrainte de validation par rappel individuel n'est modifié.

## Surface de requêtes (`lib/push/queries.ts`)

Remplace la surface bornée à un seul enregistrement (`getReminder`/`upsertReminder`,
`.limit(1)`/`.maybeSingle()`) par une surface CRUD sur liste :

- `getReminders(supabase): Promise<Reminder[]>` — tous les rappels de l'utilisateur
  courant, triés par `time_local` croissant.
- `createReminder(supabase, input): Promise<SaveReminderResult>` — insère un nouveau
  rappel.
- `updateReminder(supabase, id, input): Promise<SaveReminderResult>` — met à jour un
  rappel existant, sans toucher aux autres.
- `deleteReminder(supabase, id): Promise<void>` — supprime un rappel existant.

Détail des signatures et garanties : voir `contracts/reminders-queries.md`.

## Calcul dérivé (`lib/reminders/next.ts`)

`nextReminderLabel` passe de `(reminder: ReminderSchedule | null, now: Date)` à
`(reminders: ReminderSchedule[], now: Date)`. Aucun nouveau champ : `ReminderSchedule`
reste `{ timeLocal, weekdays, timezone, active }`, seule la cardinalité de l'entrée
change. Détail de l'algorithme : voir `contracts/next-reminder.md` et
`research.md` § 1.

## Relations

```text
auth.users 1───* reminders            (inchangé dans son sens, la cardinalité déjà
                                        permise par le schéma est enfin exploitée)
reminders  1───* reminder_sends       (inchangé — unicité sur reminder_id + sent_on,
                                        donc l'idempotence par rappel individuel ne
                                        change pas avec plusieurs rappels)
reminders  *───1 auth.users 1───* push_subscriptions   (inchangé)
```
