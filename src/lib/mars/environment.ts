import * as THREE from 'three'
import { fbm, noise2D } from './noise'
import type { TerrainData } from './terrain'

export interface SunData {
  light: THREE.DirectionalLight
  pivot: THREE.Object3D
  position: THREE.Vector3
  color: THREE.Color
}

// Sky dome with custom atmospheric gradient shader.
export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 32, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#5a3a1a') },
      uHorizonColor: { value: new THREE.Color('#c9772e') },
      uSunColor: { value: new THREE.Color('#ffd9a0') },
      uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.2).normalize() },
      uSunElevation: { value: 0.6 },
      uDust: { value: 0.6 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldDir;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunElevation;
      uniform float uDust;
      uniform float uTime;

      // cheap hash noise for haze banding
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i+vec2(1.0,0.0));
        float c = hash(i+vec2(0.0,1.0));
        float d = hash(i+vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      void main(){
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y*0.5+0.5, 0.0, 1.0);
        // Gradient: horizon butterscotch -> top darker dusty
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.55));

        // Sun glow
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float glow = pow(sunDot, 8.0) * 0.5 + pow(sunDot, 220.0) * 1.4;
        col += uSunColor * glow;

        // Atmospheric bluish horizon near sunset (low sun)
        float lowSun = clamp(1.0 - abs(uSunElevation), 0.0, 1.0);
        float band = smoothstep(0.0, 0.25, dir.y) * (1.0 - smoothstep(0.25, 0.6, dir.y));
        col += vec3(0.18, 0.32, 0.55) * band * lowSun * 0.6;

        // Dust haze banding near horizon
        float haze = (1.0 - smoothstep(0.0, 0.35, dir.y)) * uDust;
        float n = vnoise(dir.xz*8.0 + uTime*0.02);
        col += vec3(0.5, 0.28, 0.12) * haze * (0.25 + n*0.25);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const sky = new THREE.Mesh(geo, mat)
  sky.name = 'sky'
  return sky
}

export function createSun(): SunData {
  const pivot = new THREE.Object3D()
  const light = new THREE.DirectionalLight('#fff1d0', 2.4)
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.camera.near = 1
  light.shadow.camera.far = 260
  const s = 90
  light.shadow.camera.left = -s
  light.shadow.camera.right = s
  light.shadow.camera.top = s
  light.shadow.camera.bottom = -s
  light.shadow.bias = -0.0006
  light.shadow.normalBias = 0.04
  light.position.set(40, 70, 30)
  pivot.add(light)
  return { light, pivot, position: light.position.clone(), color: light.color.clone() }
}

// Dust devil / atmospheric dust particle system driven in the vertex shader.
export function createDustParticles(): THREE.Points {
  const COUNT = 1400
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(COUNT * 3)
  const seeds = new Float32Array(COUNT)
  const sizes = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const r = 6 + Math.random() * 90
    const a = Math.random() * Math.PI * 2
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = Math.random() * 24
    positions[i * 3 + 2] = Math.sin(a) * r
    seeds[i] = Math.random() * 1000
    sizes[i] = 0.4 + Math.random() * 1.2
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#d99a5a') },
      uOpacity: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float swirl = aSeed + uTime*0.15;
        // dust devil rotation + drift
        float r = length(p.xz);
        float ang = atan(p.z, p.x) + sin(swirl)*0.6 + uTime*0.05*(1.0+aSeed*0.001);
        p.x = cos(ang)*r;
        p.z = sin(ang)*r;
        p.y += sin(uTime*0.4 + aSeed)*1.2;
        p.y = mod(p.y + uTime*0.3, 26.0);
        vAlpha = 0.35 + 0.25*sin(aSeed*2.0 + uTime);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (140.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  })
  const pts = new THREE.Points(geo, mat)
  pts.name = 'dust'
  pts.frustumCulled = false
  return pts
}

// Instanced boulders scattered across the terrain (performance-friendly).
export function createBoulders(terrain: TerrainData, count = 90): THREE.InstancedMesh {
  const baseGeo = new THREE.DodecahedronGeometry(1, 0)
  // Slightly irregularize
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a2c1a'),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })
  const inst = new THREE.InstancedMesh(baseGeo, mat, count)
  inst.castShadow = true
  inst.receiveShadow = true

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const half = 100
  let placed = 0
  let attempts = 0
  while (placed < count && attempts < count * 8) {
    attempts++
    const x = (Math.random() - 0.5) * half * 2
    const z = (Math.random() - 0.5) * half * 2
    // avoid spawn area
    if (Math.sqrt(x * x + z * z) < 12) continue
    const slope = terrain.getSlope(x, z)
    if (slope > 0.5) continue
    const y = terrain.getHeight(x, z)
    const s = 0.5 + Math.random() * 2.0
    dummy.position.set(x, y + s * 0.4, z)
    dummy.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4)
    dummy.scale.set(s, s * (0.7 + Math.random() * 0.5), s)
    dummy.updateMatrix()
    inst.setMatrixAt(placed, dummy.matrix)
    // color variation: darker basalt vs rusty
    const t = Math.random()
    color.setHSL(0.04 + Math.random() * 0.03, 0.6, 0.12 + t * 0.16)
    inst.setColorAt(placed, color)
    placed++
  }
  inst.count = placed
  inst.instanceMatrix.needsUpdate = true
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  return inst
}

// Marker beacons above each POI (glowing vertical pillars).
export function createPOIMarkers(terrain: TerrainData, pois: { id: string; x: number; z: number }[]) {
  const group = new THREE.Group()
  group.name = 'poi-markers'
  const geo = new THREE.CylinderGeometry(0.12, 0.12, 8, 8, 1, true)
  for (const p of pois) {
    const y = terrain.getHeight(p.x, p.z)
    const color =
      p.id.includes('ice') || false
        ? '#7ec8ff'
        : '#ffcf4a'
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const m = new THREE.Mesh(geo, mat)
    m.position.set(p.x, y + 4, p.z)
    m.userData.poiId = p.id
    group.add(m)
    // small glowing orb on top
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      new THREE.MeshBasicMaterial({ color })
    )
    orb.position.set(p.x, y + 0.6, p.z)
    orb.userData.poiId = p.id
    group.add(orb)
  }
  return group
}
