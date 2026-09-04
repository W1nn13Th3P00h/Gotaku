# Contrat interne : `lib/reminders/next.ts`

Remplace le contrat de `specs/004-pwa-push-reminder` pour `nextReminderLabel`. Module
pur (inchangé) : `now` est injecté, aucune lecture d'horloge ici.

```ts
type ReminderSchedule = {
  timeLocal: string
  weekdays: number[]
  timezone: string
  active: boolean
}
```

## `nextReminderLabel(reminders: ReminderSchedule[], now: Date): string | null`

1. Ne retient que les rappels `active` avec `weekdays.length > 0` — un rappel inactif
   ou sans aucun jour coché n'est jamais candidat (identique à la règle à un seul
   rappel du Lot 5, appliquée ici par élément).
2. Pour chaque candidat, calcule le nombre de minutes jusqu'à sa prochaine occurrence
   (voir `research.md` § 1) : jour de semaine et minutes depuis minuit dans la
   timezone du rappel, recherche du premier jour coché en partant d'aujourd'hui
   (l'heure du jour même ne compte que si elle n'est pas déjà passée).
3. Retient le candidat dont ce nombre de minutes est le plus petit. En cas d'égalité
   stricte entre plusieurs candidats, retient le premier dans l'ordre du tableau
   reçu.
4. Retourne le libellé de ce candidat, formaté exactement comme avant :
   `"aujourd'hui à HH:MM"`, `"demain à HH:MM"`, ou `"<jour> à HH:MM"`.
5. Retourne `null` si `reminders` est vide ou si aucun candidat ne passe l'étape 1 —
   remplace l'ancien cas `reminder === null`.

**Garanties** (à couvrir par `next.test.ts`) :

- Un tableau vide renvoie `null` (remplace l'ancien cas `null` en entrée).
- Avec un seul élément actif et correctement configuré, le comportement est
  identique bit à bit à l'ancienne version à un seul rappel (nouveaux tests
  réutilisant les cas déjà couverts par le Lot 5 : aujourd'hui/demain/jour nommé,
  heure pile déjà passée, timezone propre au rappel).
- Avec deux rappels actifs à des horaires différents, le libellé retenu correspond
  toujours à celui dont l'occurrence est la plus proche, quel que soit l'ordre des
  deux dans le tableau.
- Un rappel inactif ou sans jour coché n'est jamais retenu même s'il serait autrement
  le plus proche.
- Deux rappels dont l'occurrence calculée tombe au même nombre de minutes retournent
  le libellé du premier dans l'ordre reçu.

## Hors contrat

- Ne décide jamais de l'envoi réel : ça reste `selectDueReminders`
  (`lib/reminders/due.ts`) côté Edge Function, non modifié par cette feature.
