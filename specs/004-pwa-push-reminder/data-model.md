# Phase 1 — Data Model: PWA et rappel push (Lot 5)

Aucune nouvelle table (`push_subscriptions`, `reminders`, `reminder_sends` existent
depuis le Lot 0). Cette feature ajoute des lectures/écritures et deux modèles en
mémoire pour la logique pure.

## Reminder (lecture/écriture, `reminders`)

Un seul par utilisateur en v1 (Assumptions du spec).

| Champ | Note |
|---|---|
| `id`, `userId` | |
| `timeLocal` | heure locale, ex. `07:30` |
| `weekdays` | `number[]`, 1 = lundi … 7 = dimanche ; jamais vide si `active` (FR-007) |
| `timezone` | IANA, ex. `Europe/Paris` ; détectée par défaut, modifiable |
| `active` | booléen |

## PushSubscriptionRow (lecture/écriture, `push_subscriptions`)

| Champ | Note |
|---|---|
| `id`, `userId`, `endpoint`, `p256dh`, `auth`, `userAgent` | posés à l'abonnement |
| `failureCount` | géré par `nextSubscriptionState` (voir research.md) |
| `lastSuccessAt` | remis à jour à chaque succès |

## DueContext (entrée de `selectDueReminders`, en mémoire, pas persisté)

| Champ | Type | Origine |
|---|---|---|
| `nowUtc` | `Date` | horloge de l'Edge Function, injectée pour les tests |
| `alreadySentReminderIds` | `Set<string>` | `reminder_sends` où `sent_on` = date du jour, calculée par rappel dans sa propre timezone |
| `completedTodayUserIds` | `Set<string>` | `sessions` où `status = 'completed'` et `completed_at` tombe aujourd'hui, dans la timezone de chaque rappel |

`selectDueReminders(reminders: Reminder[], ctx: DueContext): Reminder[]` retourne les
rappels à traiter ce cycle (voir `contracts/`).

## SubscriptionFailureAction (sortie de `nextSubscriptionState`, en mémoire)

| Valeur | Effet appliqué par l'Edge Function |
|---|---|
| `'delete'` | `delete from push_subscriptions where id = ...` |
| `'increment'` | `update push_subscriptions set failure_count = failure_count + 1 where id = ...` |
| `'reset'` | `update push_subscriptions set failure_count = 0, last_success_at = now() where id = ...` |

## Relations

```text
reminders 1───* reminder_sends (unicité sur reminder_id + sent_on)
reminders *───1 auth.users 1───* push_subscriptions
auth.users 1───* sessions (pour la vérification "séance déjà faite aujourd'hui")
```
