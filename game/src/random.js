// A tiny seeded random generator (mulberry32) so the same seed always deals the
// same bricks, drops and ball launches — screenshots and replays stay identical.

/** Create a generator from an integer seed. */
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a generator. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one element of an array from a generator. */
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with the given probability (0..1) from a generator. */
export function randChance(rng, probability) {
  return rng() < probability;
}
