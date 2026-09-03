// Edge Function Deno, invoquée par Supabase Cron toutes les cinq minutes (voir
// quickstart.md § Pré-requis — création du job Cron, étape manuelle hors
// périmètre). Orchestration autour de deux modules purs, importés par chemin
// relatif (Deno ne résout pas les alias `tsconfig`) : `selectDueReminders`
// décide qui est dû, `nextSubscriptionState` décide quoi faire d'un résultat
// d'envoi. Cette fonction se contente de charger les données, appliquer ces
// décisions, et effectuer les écritures.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

import { selectDueReminders, type DueContext, type Reminder } from '../../../lib/reminders/due.ts'
import { nextSubscriptionState, type SendOutcome } from '../../../lib/reminders/failures.ts'

type ReminderRow = {
  id: string
  user_id: string
  time_local: string
  weekdays: number[]
  timezone: string
  active: boolean
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`)
  return value
}

/** `en-CA` formate directement en `YYYY-MM-DD`, le format attendu par la colonne `date` `sent_on`. */
function localDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    timeLocal: row.time_local.slice(0, 5),
    weekdays: row.weekdays,
    timezone: row.timezone,
    active: row.active,
  }
}

async function sendToSubscription(
  subscription: PushSubscriptionRow,
): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title: 'Gokaku', body: "C'est l'heure de ta séance." }),
    )
    return { kind: 'success' }
  } catch (error) {
    const httpStatus = (error as { statusCode?: number }).statusCode ?? 500
    return { kind: 'failure', httpStatus }
  }
}

async function handleRequest(): Promise<Response> {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))

  webpush.setVapidDetails(
    requiredEnv('VAPID_SUBJECT'),
    requiredEnv('VAPID_PUBLIC_KEY'),
    requiredEnv('VAPID_PRIVATE_KEY'),
  )

  const { data: reminderRows, error: remindersError } = await supabase
    .from('reminders')
    .select('id, user_id, time_local, weekdays, timezone, active')
    .eq('active', true)
  if (remindersError) throw remindersError

  const reminders = ((reminderRows ?? []) as ReminderRow[]).map(toReminder)

  const nowUtc = new Date()
  const alreadySentReminderIds = new Set<string>()
  const completedTodayUserIds = new Set<string>()

  // Calculés par rappel dans sa propre timezone (data-model.md § DueContext) :
  // au plus un rappel réel dans ce lot, une requête par rappel est largement
  // suffisante (voir plan.md § Performance Goals).
  // Large de deux jours de part et d'autre : suffisant pour couvrir n'importe
  // quel décalage de timezone autour de `nowUtc` (± 14h maximum en réalité),
  // sans ramener tout l'historique complété de l'utilisateur.
  const completedWindowStart = new Date(nowUtc.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

  for (const reminder of reminders) {
    const localToday = localDateString(nowUtc, reminder.timezone)

    const { data: sendRows, error: sendError } = await supabase
      .from('reminder_sends')
      .select('reminder_id')
      .eq('reminder_id', reminder.id)
      .eq('sent_on', localToday)
      .limit(1)
    if (sendError) throw sendError
    if (sendRows && sendRows.length > 0) alreadySentReminderIds.add(reminder.id)

    const { data: completedRows, error: completedError } = await supabase
      .from('sessions')
      .select('completed_at')
      .eq('user_id', reminder.userId)
      .eq('status', 'completed')
      .gte('completed_at', completedWindowStart)
    if (completedError) throw completedError

    const completedToday = (completedRows ?? []).some((row) => {
      const completedAt = (row as { completed_at: string | null }).completed_at
      return completedAt && localDateString(new Date(completedAt), reminder.timezone) === localToday
    })
    if (completedToday) completedTodayUserIds.add(reminder.userId)
  }

  const ctx: DueContext = { nowUtc, alreadySentReminderIds, completedTodayUserIds }
  const dueReminders = selectDueReminders(reminders, ctx)

  let sent = 0
  let skippedAlreadyClaimed = 0

  for (const reminder of dueReminders) {
    const localToday = localDateString(nowUtc, reminder.timezone)

    // Réclame avant d'envoyer (research.md § Idempotence) : sous deux cycles
    // concurrents, un seul gagne l'insertion et envoie réellement.
    const { data: claimed, error: claimError } = await supabase
      .from('reminder_sends')
      .insert({ reminder_id: reminder.id, sent_on: localToday })
      .select('reminder_id')
    if (claimError) {
      // Contrainte d'unicité violée : un cycle concurrent a déjà réclamé cet envoi.
      skippedAlreadyClaimed++
      continue
    }
    if (!claimed || claimed.length === 0) {
      skippedAlreadyClaimed++
      continue
    }

    const { data: subscriptionRows, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, failure_count')
      .eq('user_id', reminder.userId)
    if (subscriptionsError) throw subscriptionsError

    for (const subscription of (subscriptionRows ?? []) as PushSubscriptionRow[]) {
      const outcome = await sendToSubscription(subscription)
      const state = nextSubscriptionState(subscription.failure_count, outcome)

      if (state.action === 'delete') {
        const { error } = await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
        if (error) throw error
      } else if (state.action === 'increment') {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ failure_count: subscription.failure_count + 1 })
          .eq('id', subscription.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ failure_count: 0, last_success_at: new Date().toISOString() })
          .eq('id', subscription.id)
        if (error) throw error
      }

      if (outcome.kind === 'success') sent++
    }
  }

  return Response.json({ dueReminders: dueReminders.length, sent, skippedAlreadyClaimed })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    return await handleRequest()
  } catch (error) {
    console.error('send-reminders', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
})
