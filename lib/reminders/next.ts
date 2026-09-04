import { localWeekdayAndMinutes, parseTimeLocalToMinutes } from '@/lib/reminders/due'

/**
 * Prochaine occurrence d'un rappel, en toutes lettres, pour l'accueil
 * (`docs/spec.md` § Accueil : « l'heure du prochain rappel »).
 *
 * Module pur : `now` est injecté, aucune lecture d'horloge ici. Ce n'est pas
 * l'ordonnanceur — l'envoi réel reste décidé par `selectDueReminders` côté Edge
 * Function. Les deux lisent la même timezone et le même `weekdays`, donc ne
 * peuvent pas diverger sur le jour retenu.
 */

export type ReminderSchedule = {
  /** Heure locale, format `HH:MM`. */
  timeLocal: string
  /** 1 = lundi … 7 = dimanche. */
  weekdays: number[]
  /** IANA, ex. `Europe/Paris`. */
  timezone: string
  active: boolean
}

const WEEKDAY_LABELS_FR = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const

/**
 * `null` quand il n'y a rien à annoncer : rappel absent, désactivé, ou sans
 * aucun jour coché. L'appelant affiche alors l'invitation à le régler plutôt
 * qu'une heure trompeuse.
 */
export function nextReminderLabel(reminder: ReminderSchedule | null, now: Date): string | null {
  if (reminder === null || !reminder.active || reminder.weekdays.length === 0) return null

  const { weekday, minutesSinceMidnight } = localWeekdayAndMinutes(now, reminder.timezone)
  const targetMinutes = parseTimeLocalToMinutes(reminder.timeLocal)

  // 0 à 7 : à 7 on est revenu au même jour de semaine, donc une correspondance
  // est garantie dès que `weekdays` n'est pas vide.
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = ((weekday - 1 + offset) % 7) + 1
    if (!reminder.weekdays.includes(candidate)) continue
    // L'heure d'aujourd'hui ne compte que si elle n'est pas déjà passée.
    if (offset === 0 && minutesSinceMidnight >= targetMinutes) continue

    if (offset === 0) return `aujourd'hui à ${reminder.timeLocal}`
    if (offset === 1) return `demain à ${reminder.timeLocal}`
    return `${WEEKDAY_LABELS_FR[candidate - 1]} à ${reminder.timeLocal}`
  }

  return null
}
