# Contrat interne : `lib/push/` et l'écran de réglages

## `lib/push/vapid.ts`

### `urlBase64ToUint8Array(base64: string): Uint8Array`

Pure. Convertit `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (base64 URL-safe) au format attendu par
`applicationServerKey` de `PushManager.subscribe`.

## `lib/push/subscribe.ts` (client, pas pur — accès navigateur + Supabase)

### `subscribeToPush(): Promise<{ ok: true } | { ok: false; reason: 'permission_denied' | 'unsupported' }>`

Appelée uniquement depuis le gestionnaire de clic du bouton « activer les
notifications ». Dans l'ordre : `Notification.requestPermission()` → si refusée,
retourne `permission_denied` sans rien écrire ; si accordée,
`registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey:
urlBase64ToUint8Array(...) })` → écrit la ligne dans `push_subscriptions` via le
client Supabase du navigateur.

## `lib/push/queries.ts`

### `getReminder(supabase): Promise<Reminder | null>`

Le rappel de l'utilisateur, `null` si jamais réglé.

### `upsertReminder(supabase, input): Promise<{ ok: true } | { ok: false; reason: 'NO_WEEKDAY' }>`

Crée ou met à jour l'unique rappel de l'utilisateur. Refuse `NO_WEEKDAY` si
`input.active` et `input.weekdays.length === 0` (FR-007).

## Écran de réglages (`app/settings/`)

- **Server Component** (`page.tsx`) : charge `getReminder`, transmet au client.
- **Client** (`settings-screen.tsx`) :
  - Détecte le mode installé (`research.md` § Détection de l'installation) : affiche
    l'écran d'installation ou le bouton d'activation en conséquence.
  - Le formulaire du rappel (heure, jours, timezone détectée/modifiable, activation)
    appelle `upsertReminder` à la sauvegarde.
  - N'appelle jamais `Notification.requestPermission()` ni `subscribeToPush()` en
    dehors du gestionnaire de clic du bouton dédié (FR-003).

## Hors contrat

- Aucune fonction de ce module n'envoie de Web Push : c'est le rôle exclusif de
  l'Edge Function (`supabase/functions/send-reminders/`).
- Aucune fonction ne gère plusieurs rappels par utilisateur (v1 : un seul, voir
  Assumptions du spec).
