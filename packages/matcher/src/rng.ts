/**
 * Deterministic seeded PRNG (mulberry32). Math.random() is not seedable, and
 * the spec requires: same seed + input -> identical output. Never use
 * Math.random() or Date.now() anywhere else in this package.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a seeded rng, returns a new array. */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = out[i] as T;
    const aj = out[j] as T;
    out[i] = aj;
    out[j] = ai;
  }
  return out;
}
