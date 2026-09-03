# Contrat interne : `lib/reminders/due.ts` et `lib/reminders/failures.ts`

Modules purs. Aucun import via l'alias `@/` (voir `plan.md` § Project Structure) :
importés tels quels par `supabase/functions/send-reminders/index.ts` (Deno) et par
Vitest, chemin relatif dans les deux cas.

## `selectDueReminders(reminders: Reminder[], ctx: DueContext): Reminder[]`

Pour chaque rappel `active` :

1. Calculer, dans `reminder.timezone`, le jour de semaine local (1 = lundi … 7 =
   dimanche) et les minutes écoulées depuis minuit à `ctx.nowUtc`.
2. Retenir le rappel si son jour de semaine local est dans `reminder.weekdays`, ET que
   les minutes locales tombent dans `[cible, cible + 5)` où `cible` est l'heure de
   `reminder.timeLocal` convertie en minutes depuis minuit.
3. Écarter le rappel si son `id` est dans `ctx.alreadySentReminderIds`.
4. Écarter le rappel si son `userId` est dans `ctx.completedTodayUserIds`.

Retourne la liste des rappels retenus, dans l'ordre reçu. Ne fait aucun accès
réseau/base : tout ce dont elle a besoin est déjà dans `reminders` et `ctx`.

**Garanties** (couvertes par `due.test.ts`) :
- Un rappel inactif n'est jamais retenu, quels que soient l'heure/le jour.
- Un rappel dont l'heure locale correspond mais dont le jour local n'est pas dans
  `weekdays` n'est jamais retenu.
- Un rappel à cheval sur un changement de jour dans sa timezone (proche de minuit
  local) utilise le jour local, pas le jour UTC.
- Un rappel déjà dans `alreadySentReminderIds` n'est jamais retenu, même si
  l'heure/le jour correspondent encore.
- Un rappel dont l'utilisateur est dans `completedTodayUserIds` n'est jamais retenu.

## `nextSubscriptionState(currentFailureCount: number, outcome: { kind: 'success' } | { kind: 'failure'; httpStatus: number }): { action: 'delete' | 'increment' | 'reset' }`

- `outcome.kind === 'success'` → `{ action: 'reset' }`
- `outcome.httpStatus` ∈ `{404, 410}` → `{ action: 'delete' }`
- sinon, si `currentFailureCount + 1 >= 5` → `{ action: 'delete' }`
- sinon → `{ action: 'increment' }`

**Garanties** (couvertes par `failures.test.ts`) :
- Un échec 404 ou 410 supprime dès le premier échec, quel que soit `currentFailureCount`.
- Un échec quelconque au 4ᵉ échec consécutif (`currentFailureCount = 4`) donne
  `delete` (5ᵉ échec atteint) ; au 3ᵉ (`currentFailureCount = 3`) donne `increment`.
- Un succès donne toujours `reset`, y compris à `currentFailureCount = 0`.

## Hors contrat

- Ni `due.ts` ni `failures.ts` n'effectuent d'écriture ou de lecture en base : c'est la
  responsabilité de l'Edge Function (`supabase/functions/send-reminders/index.ts`), qui
  leur fournit des données déjà chargées et applique leurs résultats.
- Ni l'un ni l'autre n'importe une bibliothèque de manipulation de dates tierce :
  `Intl.DateTimeFormat`, disponible nativement en Node comme en Deno, suffit au calcul
  du jour/heure local par timezone.
