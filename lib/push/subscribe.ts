import { urlBase64ToUint8Array } from '@/lib/push/vapid'
import { createClient } from '@/lib/supabase/client'

/**
 * Client, pas pur (accès navigateur + Supabase) — voir
 * `contracts/settings-screen.md`. Appelée uniquement depuis le gestionnaire de
 * clic du bouton « activer les notifications » (FR-003) : ni au montage, ni au
 * chargement de la page.
 */
export type SubscribeResult = { ok: true } | { ok: false; reason: 'permission_denied' | 'unsupported' }

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'permission_denied' }
  }

  const registration = await navigator.serviceWorker.ready

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    throw new Error(
      "Variable d'environnement manquante : NEXT_PUBLIC_VAPID_PUBLIC_KEY. Voir quickstart.md § Pré-requis.",
    )
  }

  const pushSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const { endpoint } = pushSubscription
  const key = pushSubscription.toJSON().keys
  const p256dh = key?.p256dh
  const auth = key?.auth
  if (!p256dh || !auth) {
    throw new Error('abonnement Web Push sans clés p256dh/auth')
  }

  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('subscribeToPush appelée sans utilisateur authentifié')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error

  return { ok: true }
}
