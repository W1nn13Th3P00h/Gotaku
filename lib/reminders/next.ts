import { localWeekdayAndMinutes, parseTimeLocalToMinutes } from '@/lib/reminders/due'

/**
 * Prochaine occurrence parmi plusieurs rappels, en toutes lettres, pour l'accueil
 * (`docs/spec.md` § Accueil : « l'heure du prochain rappel »). Voir
 * `specs/006-multiple-reminders/contracts/next-reminder.md`.
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

type NextOccurrence = {
  reminder: ReminderSchedule
  /** 0 = aujourd'hui … 7 = dans une semaine (même jour de semaine). */
  offset: number
  candidateWeekday: number
  /** Minutes jusqu'à l'occurrence, dans la timezone propre du rappel (research.md § 1). */
  minutesUntil: number
}

/** `null` si aucun jour coché n'est atteignable — ne devrait pas arriver (0 à 7 couvre une semaine complète). */
function nextOccurrence(reminder: ReminderSchedule, now: Date): NextOccurrence | null {
  const { weekday, minutesSinceMidnight } = localWeekdayAndMinutes(now, reminder.timezone)
  const targetMinutes = parseTimeLocalToMinutes(reminder.timeLocal)

  // 0 à 7 : à 7 on est revenu au même jour de semaine, donc une correspondance
  // est garantie dès que `weekdays` n'est pas vide.
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateWeekday = ((weekday - 1 + offset) % 7) + 1
    if (!reminder.weekdays.includes(candidateWeekday)) continue
    // L'heure d'aujourd'hui ne compte que si elle n'est pas déjà passée.
    if (offset === 0 && minutesSinceMidnight >= targetMinutes) continue

    return {
      reminder,
      offset,
      candidateWeekday,
      minutesUntil: offset * 1440 + (targetMinutes - minutesSinceMidnight),
    }
  }

  return null
}

/**
 * `null` quand il n'y a rien à annoncer : aucun rappel, aucun actif, ou aucun avec
 * un jour coché. L'appelant affiche alors l'invitation à en régler un plutôt qu'un
 * libellé trompeur.
 */
export function nextReminderLabel(reminders: ReminderSchedule[], now: Date): string | null {
  let soonest: NextOccurrence | null = null

  for (const reminder of reminders) {
    if (!reminder.active || reminder.weekdays.length === 0) continue

    const candidate = nextOccurrence(reminder, now)
    if (candidate === null) continue

    // Comparaison stricte : à égalité, le premier rencontré dans l'ordre reçu
    // l'emporte (contracts/next-reminder.md § Garanties).
    if (soonest === null || candidate.minutesUntil < soonest.minutesUntil) {
      soonest = candidate
    }
  }

  if (soonest === null) return null

  const { offset, candidateWeekday, reminder } = soonest
  if (offset === 0) return `aujourd'hui à ${reminder.timeLocal}`
  if (offset === 1) return `demain à ${reminder.timeLocal}`
  return `${WEEKDAY_LABELS_FR[candidateWeekday - 1]} à ${reminder.timeLocal}`
}
