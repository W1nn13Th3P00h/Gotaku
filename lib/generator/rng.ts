/**
 * PRNG déterministe seedé (mulberry32). Jamais `Math.random()` : même seed, même
 * séquence, ce qui rend une séance reproductible.
 */
export type Rng = {
  next: () => number
  uniform: (min: number, max: number) => number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const uniform = (min: number, max: number): number => min + next() * (max - min)

  return { next, uniform }
}
