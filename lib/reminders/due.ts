/**
 * Module pur, sans alias `@/` (voir `contracts/reminders-logic.md` et
 * `plan.md` § Technical Context) : importé tel quel par
 * `supabase/functions/send-reminders/index.ts` (Deno, qui ne résout pas les
 * alias `tsconfig`) et par Vitest, chemin relatif dans les deux cas.
 *
 * Ne fait aucun accès réseau/base : tout ce dont `selectDueReminders` a besoin
 * est déjà dans `reminders` et `ctx`, chargés par l'appelant.
 */

export type Reminder = {
  id: string
  userId: string
  /** Heure locale, format `HH:MM`. */
  timeLocal: string
  /** 1 = lundi … 7 = dimanche. */
  weekdays: number[]
  /** IANA, ex. `Europe/Paris`. */
  timezone: string
  active: boolean
}

export type DueContext = {
  /** Horodatage de référence, injecté (jamais `new Date()` lu directement ici). */
  nowUtc: Date
  /** `reminder_sends` où `sent_on` = date du jour, dans la timezone de chaque rappel. */
  alreadySentReminderIds: Set<string>
  /** `sessions` complétées aujourd'hui, dans la timezone de chaque rappel. */
  completedTodayUserIds: Set<string>
}

/** Fenêtre de correspondance : cinq minutes, bornée à gauche (voir research.md). */
const MATCH_WINDOW_MINUTES = 5

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

function parseTimeLocalToMinutes(timeLocal: string): number {
  const [hourStr, minuteStr] = timeLocal.split(':')
  return Number(hourStr) * 60 + Number(minuteStr)
}

/**
 * Jour de semaine local (1 = lundi … 7 = dimanche) et minutes écoulées depuis
 * minuit local, dans `timezone`, à `date`. `Intl.DateTimeFormat` : disponible
 * nativement en Node/Vitest comme en Deno, aucune bibliothèque de dates tierce.
 */
function localWeekdayAndMinutes(
  date: Date,
  timezone: string,
): { weekday: number; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const weekdayName = parts.find((p) => p.type === 'weekday')?.value
  const hourStr = parts.find((p) => p.type === 'hour')?.value
  const minuteStr = parts.find((p) => p.type === 'minute')?.value

  const weekdayIndex = WEEKDAY_NAMES.indexOf((weekdayName ?? '') as (typeof WEEKDAY_NAMES)[number])
  if (weekdayIndex === -1 || hourStr === undefined || minuteStr === undefined) {
    throw new Error(`jour/heure local introuvable pour la timezone "${timezone}"`)
  }

  return {
    weekday: weekdayIndex + 1,
    minutesSinceMidnight: Number(hourStr) * 60 + Number(minuteStr),
  }
}

/** Voir `contracts/reminders-logic.md` § selectDueReminders. */
export function selectDueReminders(reminders: Reminder[], ctx: DueContext): Reminder[] {
  return reminders.filter((reminder) => {
    if (!reminder.active) return false
    if (ctx.alreadySentReminderIds.has(reminder.id)) return false
    if (ctx.completedTodayUserIds.has(reminder.userId)) return false

    const { weekday, minutesSinceMidnight } = localWeekdayAndMinutes(ctx.nowUtc, reminder.timezone)
    if (!reminder.weekdays.includes(weekday)) return false

    const targetMinutes = parseTimeLocalToMinutes(reminder.timeLocal)
    return (
      minutesSinceMidnight >= targetMinutes &&
      minutesSinceMidnight < targetMinutes + MATCH_WINDOW_MINUTES
    )
  })
}
