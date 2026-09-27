import { createNoise2D } from 'simplex-noise'

// Shared deterministic noise generators for the Martian world.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng1 = mulberry32(1337)
const rng2 = mulberry32(7331)
const rng3 = mulberry32(4242)

export const noise2D = createNoise2D(rng1)
export const noise2DDetail = createNoise2D(rng2)
export const noise2DCrater = createNoise2D(rng3)

export interface Crater {
  x: number
  z: number
  r: number
  depth: number
}

// Pre-generate craters across the map deterministically.
export function generateCraters(count: number, spread: number, minR: number, maxR: number): Crater[] {
  const craters: Crater[] = []
  for (let i = 0; i < count; i++) {
    const x = (rng1() - 0.5) * spread
    const z = (rng2() - 0.5) * spread
    const r = minR + rng3() * (maxR - minR)
    const depth = r * (0.25 + rng1() * 0.35)
    craters.push({ x, z, r, depth })
  }
  return craters
}

// Layered fbm noise for natural terrain.
export function fbm(x: number, z: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

export function ridgedFbm(x: number, z: number, octaves = 4): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2D(x * freq, z * freq))
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}
