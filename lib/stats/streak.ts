/**
 * Calcul du streak (jours consécutifs avec au moins une séance `completed`),
 * module pur — même philosophie que `lib/generator/` : toute source de temps
 * est injectée, jamais `Date.now()`.
 */

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, delta: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + delta)
  return copy
}

/**
 * Jours calendaires consécutifs avec au moins une séance `completed`, en
 * remontant depuis `now`. Si aucune séance aujourd'hui, la remontée part
 * d'hier : le streak n'est pas cassé tant qu'un jour complet sans séance n'est
 * pas dépassé (FR streak, issue #15). `completedDays` peut contenir des
 * doublons et être dans le désordre.
 */
export function computeStreak(completedDays: Date[], now: Date): number {
  if (completedDays.length === 0) return 0

  const daySet = new Set(completedDays.map((d) => startOfLocalDay(d).getTime()))

  const today = startOfLocalDay(now)
  let cursor = daySet.has(today.getTime()) ? today : addDays(today, -1)

  // Si ni aujourd'hui ni hier n'ont de séance, le streak est rompu.
  if (!daySet.has(cursor.getTime())) return 0

  let streak = 0
  while (daySet.has(cursor.getTime())) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}
