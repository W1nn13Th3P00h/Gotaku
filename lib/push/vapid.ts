/**
 * Pur — voir `contracts/settings-screen.md`. Convertit une clé VAPID publique
 * (base64 URL-safe, telle qu'exposée par `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) au
 * format `Uint8Array` attendu par `applicationServerKey` de
 * `PushManager.subscribe`.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = atob(base64Safe)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
