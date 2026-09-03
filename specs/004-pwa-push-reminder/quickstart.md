# Quickstart — PWA et rappel push (Lot 5)

## Pré-requis — étapes manuelles, à faire une fois, avec les identifiants de l'utilisateur

Ces étapes ne sont **pas** exécutées par un agent d'implémentation (secrets, dépôt
réel) — voir Assumptions de `spec.md` et `docs/night-log.md`.

```bash
npx web-push generate-vapid-keys
# Reporter les deux clés dans .env.local :
#   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
#   VAPID_PRIVATE_KEY=...
#   VAPID_SUBJECT=mailto:toi@exemple.fr
# Et comme secrets du projet Supabase hébergé (pour l'Edge Function) :
npx supabase secrets set VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:toi@exemple.fr
npx supabase functions deploy send-reminders
# Puis créer le job Cron (SQL, extension pg_cron, ou dashboard Supabase) :
#   select cron.schedule('send-reminders', '*/5 * * * *',
#     $$ select net.http_post(url := '.../functions/v1/send-reminders') $$);
```

## Valider manuellement (User Story 1 et 2, sans dépendre du cron)

```bash
npm run dev
```

1. Ouvrir l'application dans Safari iOS sans l'avoir ajoutée à l'écran d'accueil :
   `/settings` affiche l'écran d'installation (User Story 1, FR-001, FR-002).
2. Ajouter à l'écran d'accueil, rouvrir depuis l'icône : `/settings` affiche le bouton
   « activer les notifications » à la place.
3. Taper sur ce bouton : la demande de permission système apparaît à cet instant précis
   (FR-003), pas avant.
4. Accepter : un abonnement apparaît dans `push_subscriptions` (FR-004).
5. Régler une heure, au moins un jour, activer, recharger la page : le réglage est bien
   celui retrouvé (User Story 2).
6. Décocher tous les jours puis tenter de sauvegarder en restant actif : refusé ou
   traité comme désactivé (FR-007).

## Valider automatiquement

```bash
npm run typecheck
npm run lint
npm run test
```

`lib/reminders/due.test.ts` et `lib/reminders/failures.test.ts` couvrent la logique de
sélection et de dégressivité des échecs sans aucun envoi réel (voir
`contracts/reminders-logic.md`). Un test PGlite vérifie que l'unicité de
`reminder_sends` rejette bien un second envoi le même jour.

## Valider de bout en bout (User Story 3, après les étapes manuelles ci-dessus)

Sur un iPhone réel, avec un rappel réglé sur une heure et un jour proches de
maintenant : attendre le prochain cycle du cron, vérifier la réception de la
notification, taper dessus et vérifier l'ouverture directe de `/generateur` (FR-015).
Vérifier ensuite qu'un second cycle le même jour n'envoie pas de doublon, et qu'un jour
où une séance a déjà été terminée, rien n'arrive.

## Ce que ce lot ne couvre pas

Aucune mise en cache hors-ligne (pas d'exigence en ce sens dans `docs/spec.md`), aucune
gestion de plusieurs rappels par utilisateur.
