import * as THREE from 'three'
import { fbm, ridgedFbm, generateCraters, noise2DCrater, type Crater } from './noise'
import type { Obstacle, POI } from './store'

export const WORLD_SIZE = 220 // meters across
export const TERRAIN_SEGMENTS = 220

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()
const tmpN = new THREE.Vector3()

export interface TerrainData {
  mesh: THREE.Mesh
  detailMesh: THREE.Mesh
  getHeight: (x: number, z: number) => number
  getNormal: (x: number, z: number) => THREE.Vector3
  getSlope: (x: number, z: number) => number
  craters: Crater[]
  obstacles: Obstacle[]
  pois: POI[]
}

// Multi-layer height function combining large dunes, ridges, crater bowls & rims.
export function terrainHeight(x: number, z: number, craters: Crater[]): number {
  // Base rolling dunes
  let h = fbm(x * 0.012, z * 0.012, 5) * 6.5
  // Medium ridges / canyon walls
  h += ridgedFbm(x * 0.025, z * 0.025, 4) * 3.2
  // Fine surface ripple (sand dune texture)
  h += fbm(x * 0.08, z * 0.08, 3) * 0.45

  // Craters: bowl depression + raised rim
  for (const c of craters) {
    const dx = x - c.x
    const dz = z - c.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < c.r * 2.4) {
      const nd = d / c.r
      // Bowl: smooth depression near center
      const bowl = -c.depth * Math.exp(-((nd * 2.1) ** 2))
      // Rim: raised ring just outside the rim radius
      const rim =
        nd > 0.7 && nd < 1.6
          ? Math.sin((nd - 0.7) / 0.9 * Math.PI) * c.depth * 0.55
          : 0
      h += bowl + rim
    }
  }

  // Flatten a gentle landing zone around the spawn origin so the rover starts
  // on walkable, low-slope terrain and A* can always find an exit path.
  const spawnDist = Math.sqrt(x * x + z * z)
  const SPAWN_R = 16
  if (spawnDist < SPAWN_R) {
    const t = 1 - spawnDist / SPAWN_R
    const blend = t * t * (3 - 2 * t) // smoothstep
    h = h * (1 - blend) + 0.5 * blend
  }
  return h
}

export function createTerrain(): TerrainData {
  const rawCraters = generateCraters(18, WORLD_SIZE * 0.9, 6, 20)
  // Keep craters away from the spawn origin so the rover isn't trapped.
  const craters = rawCraters.filter((c) => Math.sqrt(c.x * c.x + c.z * c.z) > c.r + 18)

  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  const cRust = new THREE.Color('#C1440E')
  const cDarkRed = new THREE.Color('#8B0000')
  const cOchre = new THREE.Color('#b5651d')
  const cBasalt = new THREE.Color('#3a2418')
  const cDune = new THREE.Color('#d98c4a')
  const cIce = new THREE.Color('#cfe8ff')

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = terrainHeight(x, z, craters)
    pos.setY(i, h)

    // Slope estimate via neighboring noise
    const e = 0.6
    const hx1 = terrainHeight(x + e, z, craters)
    const hx2 = terrainHeight(x - e, z, craters)
    const hz1 = terrainHeight(x, z + e, craters)
    const hz2 = terrainHeight(x, z - e, craters)
    const slope = Math.atan2(Math.sqrt((hx1 - hx2) ** 2 + (hz1 - hz2) ** 2), 2 * e)

    // Color blend
    const col = cRust.clone()
    const t = THREE.MathUtils.clamp((h + 4) / 12, 0, 1)
    col.lerp(cDune, t * 0.6)
    if (h < -3.5) col.lerp(cDarkRed, 0.6)
    if (h > 5) col.lerp(cOchre, 0.5)
    // Steep walls -> darker basalt
    col.lerp(cBasalt, THREE.MathUtils.clamp(slope / 1.0, 0, 1) * 0.7)
    // Random speckle variation
    const speckle = noise2DCrater(x * 0.6, z * 0.6) * 0.08
    col.offsetHSL(0, 0, speckle)

    // Ice tint at deep crater centers
    for (const c of craters) {
      const dx = x - c.x
      const dz = z - c.z
      if (dx * dx + dz * dz < (c.r * 0.35) ** 2 && h < c.depth * -0.4) {
        col.lerp(cIce, 0.18)
      }
    }

    colors[i * 3] = col.r
    colors[i * 3 + 1] = col.g
    colors[i * 3 + 2] = col.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = false
  mesh.receiveShadow = true

  // Low-res "distant" detail plane that scrolls subtly to fake an endless horizon.
  const detailGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3, 60, 60)
  detailGeo.rotateX(-Math.PI / 2)
  const dpos = detailGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < dpos.count; i++) {
    const x = dpos.getX(i)
    const z = dpos.getZ(i)
    dpos.setY(i, fbm(x * 0.008, z * 0.008, 4) * 7 - 6)
  }
  detailGeo.computeVertexNormals()
  const detailMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7a2e0c'),
    roughness: 1,
    metalness: 0,
    fog: true,
  })
  const detailMesh = new THREE.Mesh(detailGeo, detailMat)
  detailMesh.position.y = -0.5
  detailMesh.receiveShadow = true

  // Height / normal query functions using analytic terrain (independent of mesh res)
  const getHeight = (x: number, z: number) => terrainHeight(x, z, craters)

  const getNormal = (x: number, z: number) => {
    const e = 0.5
    tmpA.set(e, terrainHeight(x + e, z, craters) - terrainHeight(x - e, z, craters), 0)
    tmpB.set(0, terrainHeight(x, z + e, craters) - terrainHeight(x, z - e, craters), e)
    tmpC.crossVectors(tmpA, tmpB).normalize()
    // tmpC currently points -Y for upward normal; flip
    tmpC.negate()
    return tmpC.clone()
  }

  const getSlope = (x: number, z: number) => {
    const e = 0.6
    const hx1 = terrainHeight(x + e, z, craters)
    const hx2 = terrainHeight(x - e, z, craters)
    const hz1 = terrainHeight(x, z + e, craters)
    const hz2 = terrainHeight(x, z - e, craters)
    return Math.atan2(Math.sqrt((hx1 - hx2) ** 2 + (hz1 - hz2) ** 2), 2 * e) // radians
  }

  // Build obstacles (craters + random boulders + steep zones)
  const obstacles: Obstacle[] = []
  for (const c of craters) {
    obstacles.push({ x: c.x, z: c.z, r: c.r * 0.95, kind: 'crater' })
  }
  // Boulder obstacles placed via noise sampling — actual meshes added by environment.ts
  const pois: POI[] = []
  const rng = (s: number) => {
    const v = Math.sin(s * 127.1 + 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  let pid = 0
  for (let i = 0; i < 26; i++) {
    const x = (rng(i * 2 + 1) - 0.5) * WORLD_SIZE * 0.85
    const z = (rng(i * 3 + 5) - 0.5) * WORLD_SIZE * 0.85
    const slope = getSlope(x, z)
    if (slope > 0.45) {
      obstacles.push({ x, z, r: 2.4, kind: 'steep' })
      continue
    }
    const kindRoll = rng(i * 7 + 9)
    let type: POI['type'] = 'anomalous-rock'
    let name = 'Anomalous Rock'
    if (kindRoll < 0.34) {
      type = 'drill-site'
      name = 'Drill Site Candidate'
    } else if (kindRoll < 0.6) {
      type = 'ice-deposit'
      name = 'Subsurface Ice Deposit'
    } else if (kindRoll < 0.82) {
      type = 'scientific'
      name = 'Stratified Outcrop'
    } else {
      type = 'anomalous-rock'
      name = 'Anomalous Rock'
    }
    pois.push({
      id: `poi-${pid++}`,
      x,
      z,
      type,
      name,
      analyzed: false,
      confidence: 70 + Math.floor(rng(i * 13) * 30),
    })
  }

  return { mesh, detailMesh, getHeight, getNormal, getSlope, craters, obstacles, pois }
}
