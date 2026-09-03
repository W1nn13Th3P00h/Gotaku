/** Formate une durée en secondes pour l'affichage : 45 → "45 s", 90 → "1 min 30", 600 → "10 min". */
export function formatDurationShort(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} s`
  if (seconds === 0) return `${minutes} min`
  return `${minutes} min ${seconds}`
}
