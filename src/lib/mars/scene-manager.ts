import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createTerrain, type TerrainData } from './terrain'
import {
  createSky,
  createSun,
  createDustParticles,
  createBoulders,
  createPOIMarkers,
  type SunData,
} from './environment'
import { RoverModel } from './rover'
import { AIEngine, type AIScienceCommand } from './ai-engine'
import { ScienceManager } from './science'
import { useMarsStore } from './store'
import { noise2D, fbm } from './noise'

const WORLD_BOUNDS = 95 // soft play area half-extent

export class SceneManager {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  private container: HTMLElement
  private terrain!: TerrainData
  private sky!: THREE.Mesh
  private skyMat!: THREE.ShaderMaterial
  private sun!: SunData
  private ambient!: THREE.AmbientLight
  private hemi!: THREE.HemisphereLight
  private dust!: THREE.Points
  private dustMat!: THREE.ShaderMaterial
  private rover!: RoverModel
  private ai!: AIEngine
  private science!: ScienceManager
  private raycaster = new THREE.Raycaster()
  private lastTime = 0
  private elapsedTime = 0
  private raf = 0
  private disposed = false

  // rover kinematic state
  private roverPos = new THREE.Vector3(0, 0, 0)
  private roverHeading = 0
  private roverSpeed = 0
  private power = 100

  // camera
  private camMode: 'follow' | 'navcam' | 'armcam' | 'orbital' = 'follow'
  private camFollowPos = new THREE.Vector3(0, 6, -10)
  private controlsEnabled = false

  // manual control
  private controlMode: 'autonomous' | 'manual' = 'autonomous'
  private keys: Record<string, boolean> = {}

  // telemetry throttle
  private telAccum = 0
  private envAccum = 0
  private weatherAccum = 0
  private minimapAccum = 0
  private fpsAccum = 0
  private fpsFrames = 0
  private fpsTime = 0

  // effects
  private drillParticles!: THREE.Points
  private drillParticleMat!: THREE.PointsMaterial
  private drillParticleVel!: Float32Array
  private spectroBeam!: THREE.Mesh
  private spectroBeamMat!: THREE.MeshBasicMaterial

  // sun azimuth/elevation (driven by solarTime)
  private sunAzimuth = Math.PI * 0.25
  private sunElevation = 0.6 // 0..1

  constructor(container: HTMLElement) {
    this.container = container
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.55
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(new THREE.Color('#b5651d'), 70, 320)

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2000)
    this.camera.position.set(0, 8, -14)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.target.set(0, 1, 0)
    this.controls.enabled = false // only in orbital mode

    this.build()
    this.bindEvents()
  }

  private build() {
    // Terrain
    this.terrain = createTerrain()
    this.scene.add(this.terrain.detailMesh)
    this.scene.add(this.terrain.mesh)

    // Sky
    this.sky = createSky()
    this.skyMat = this.sky.material as THREE.ShaderMaterial
    this.scene.add(this.sky)

    // Sun + ambient
    this.sun = createSun()
    this.scene.add(this.sun.pivot)
    this.scene.add(this.sun.light.target) // target must be in scene to update world matrix
    // Mars' dusty atmosphere scatters a lot of ambient light — high ambient fill
    // keeps the shadowed sides of the rover visible from any camera angle.
    this.ambient = new THREE.AmbientLight('#9a6a40', 1.1)
    this.scene.add(this.ambient)
    this.hemi = new THREE.HemisphereLight('#d9a868', '#3a1c0c', 1.2)
    this.scene.add(this.hemi)

    // Dust
    this.dust = createDustParticles()
    this.dustMat = this.dust.material as THREE.ShaderMaterial
    this.scene.add(this.dust)

    // Boulders
    const boulders = createBoulders(this.terrain, 110)
    this.scene.add(boulders)

    // POI markers
    const markers = createPOIMarkers(this.terrain, this.terrain.pois)
    this.scene.add(markers)

    // Rover
    this.rover = new RoverModel()
    const startY = this.terrain.getHeight(0, 0)
    this.roverPos.set(0, startY, 0)
    this.scene.add(this.rover.group)

    // AI + Science
    this.ai = new AIEngine(
      this.terrain,
      () => this.roverPos,
      () => this.roverHeading,
      () => this.power
    )
    this.science = new ScienceManager({
      spawnDrillParticles: (pos, intensity) => this.spawnDrillParticles(pos, intensity),
      spawnSpectroBeam: (pos) => this.spawnSpectroBeam(pos),
      flashPoi: (id) => this.flashPoi(id),
    })

    // Effects
    this.buildEffects()

    // Push initial data to store
    const store = useMarsStore.getState()
    store.setObstacles(this.terrain.obstacles)
    store.setPois(this.terrain.pois)
    store.setReady(true)
    store.addLog('ok', 'ARES-IV rover systems online. Autonomous mission control engaged.')
    store.addLog('ai', 'Boot sequence complete. Initiating surface survey.')
  }

  private buildEffects() {
    // Drill debris particle pool
    const COUNT = 200
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(COUNT * 3)
    this.drillParticleVel = new Float32Array(COUNT * 3)
    const life = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = 1000
      life[i] = 0
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
    this.drillParticleMat = new THREE.PointsMaterial({
      color: new THREE.Color('#c8702a'),
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    this.drillParticles = new THREE.Points(geo, this.drillParticleMat)
    this.drillParticles.frustumCulled = false
    this.scene.add(this.drillParticles)
    this._drillLife = life

    // Spectro beam (a thin glowing cylinder)
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.04, 2, 8, 1, true)
    this.spectroBeamMat = new THREE.MeshBasicMaterial({
      color: '#7eff9a',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.spectroBeam = new THREE.Mesh(beamGeo, this.spectroBeamMat)
    this.spectroBeam.visible = false
    this.scene.add(this.spectroBeam)
  }
  private _drillLife!: Float32Array
  private _drillCursor = 0

  private spawnDrillParticles(pos: THREE.Vector3, intensity: number) {
    const geo = this.drillParticles.geometry
    const posAttr = geo.attributes.position as THREE.BufferAttribute
    const n = Math.floor(2 + intensity * 3)
    for (let k = 0; k < n; k++) {
      const i = this._drillCursor
      this._drillCursor = (this._drillCursor + 1) % 200
      posAttr.setXYZ(i, pos.x, pos.y, pos.z)
      this.drillParticleVel[i * 3] = (Math.random() - 0.5) * 2.5 * intensity
      this.drillParticleVel[i * 3 + 1] = 1.5 + Math.random() * 2.5 * intensity
      this.drillParticleVel[i * 3 + 2] = (Math.random() - 0.5) * 2.5 * intensity
      this._drillLife[i] = 0.8 + Math.random() * 0.6
    }
    posAttr.needsUpdate = true
  }

  private spawnSpectroBeam(pos: THREE.Vector3) {
    this.spectroBeam.visible = true
    this.spectroBeam.position.set(pos.x, pos.y - 1, pos.z)
    this.spectroBeamMat.opacity = 0.6
  }

  private flashPoi(_id: string) {
    // could pulse marker scale
  }

  private updateEffects(dt: number) {
    const geo = this.drillParticles.geometry
    const posAttr = geo.attributes.position as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    let needsUpdate = false
    for (let i = 0; i < 200; i++) {
      if (this._drillLife[i] > 0) {
        this._drillLife[i] -= dt
        pos[i * 3] += this.drillParticleVel[i * 3] * dt
        pos[i * 3 + 1] += this.drillParticleVel[i * 3 + 1] * dt
        pos[i * 3 + 2] += this.drillParticleVel[i * 3 + 2] * dt
        this.drillParticleVel[i * 3 + 1] -= 4 * dt // gravity
        if (this._drillLife[i] <= 0) {
          pos[i * 3] = 1000
        }
        needsUpdate = true
      }
    }
    if (needsUpdate) posAttr.needsUpdate = true
    // fade spectro beam
    if (this.spectroBeamMat.opacity > 0) {
      this.spectroBeamMat.opacity = Math.max(0, this.spectroBeamMat.opacity - dt * 2)
      if (this.spectroBeamMat.opacity <= 0) this.spectroBeam.visible = false
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
  }

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys[k] = e.type === 'keydown'
    // Camera quick switch
    if (e.type === 'keydown') {
      if (k === '1') this.setCameraMode('follow')
      if (k === '2') this.setCameraMode('navcam')
      if (k === '3') this.setCameraMode('armcam')
      if (k === '4') this.setCameraMode('orbital')
      if (k === 'm') this.toggleControlMode()
    }
  }

  setCameraMode(mode: 'follow' | 'navcam' | 'armcam' | 'orbital') {
    this.camMode = mode
    useMarsStore.getState().setCameraMode(mode)
    this.controls.enabled = mode === 'orbital'
    if (mode === 'orbital') {
      this.controls.target.copy(this.roverPos).add(new THREE.Vector3(0, 1, 0))
      if (this.camera.position.length() < 5) this.camera.position.set(0, 14, -22)
    }
  }

  toggleControlMode() {
    this.controlMode = this.controlMode === 'autonomous' ? 'manual' : 'autonomous'
    useMarsStore.getState().setControlMode(this.controlMode)
    useMarsStore.getState().addLog(
      'info',
      this.controlMode === 'manual'
        ? 'Manual remote override engaged. WASD to drive.'
        : 'Autonomous AI mode resumed.'
    )
  }

  setControlMode(m: 'autonomous' | 'manual') {
    this.controlMode = m
    useMarsStore.getState().setControlMode(m)
  }

  // Manual science trigger from UI
  triggerScience(cmd: AIScienceCommand) {
    if (this.controlMode !== 'manual') {
      useMarsStore.getState().addLog('warn', 'Switch to Manual Override to trigger science manually.')
      return
    }
    // find nearest POI for context if needed
    let poi = null
    if (cmd.kind === 'drill' || cmd.kind === 'spectro' || cmd.kind === 'biosignature') {
      let best = null as null | (typeof this.terrain.pois)[number]
      let bestD = Infinity
      for (const p of this.terrain.pois) {
        const d = (p.x - this.roverPos.x) ** 2 + (p.z - this.roverPos.z) ** 2
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      poi = best
    }
    this.runScience(cmd, poi)
  }

  private runScience(cmd: AIScienceCommand, poi: any) {
    if (this.science.isActive()) {
      useMarsStore.getState().addLog('warn', 'Another science task is in progress.')
      return
    }
    this.science.start(cmd, poi, () => {
      this.ai.clearCommand()
      this.rover.setArmDeploy(0)
      this.rover.setDrilling(false)
    })
    if (cmd.kind === 'drill' || cmd.kind === 'biosignature') {
      this.rover.setArmDeploy(1)
      if (cmd.kind === 'drill') this.rover.setDrilling(true)
    }
  }

  start() {
    this.lastTime = performance.now()
    const loop = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)
      this.frame()
    }
    this.raf = requestAnimationFrame(loop)
  }

  private frame() {
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.elapsedTime += dt
    const t = this.elapsedTime

    // ===== Day cycle & sun =====
    const store = useMarsStore.getState()
    let solarTime = store.environment.solarTime + dt * 0.03 // slow day cycle
    if (solarTime >= 24) solarTime -= 24
    // sun elevation from solar time (peak at noon=12)
    const sunAngle = ((solarTime - 6) / 12) * Math.PI // 0 at 6am, PI at 6pm
    this.sunElevation = Math.sin(sunAngle) // -1..1
    this.sunAzimuth = Math.PI * (solarTime / 24) + 0.4
    const sunDist = 90
    const sx = Math.cos(this.sunAzimuth) * Math.cos(sunAngle) * sunDist
    const sy = Math.sin(this.sunAngle) * sunDist
    const sz = Math.sin(this.sunAzimuth) * Math.cos(sunAngle) * sunDist
    this.sun.light.position.set(sx, Math.max(sy, 6), sz)
    this.sun.light.target.position.copy(this.roverPos)
    const dayFactor = Math.max(0.12, this.sunElevation)
    this.sun.light.intensity = 0.8 + dayFactor * 2.6
    // color shift: warm at low sun
    const warmCol = new THREE.Color().setHSL(0.08, 0.6, 0.5 + dayFactor * 0.2)
    this.sun.light.color.copy(warmCol)
    this.ambient.intensity = 0.8 + dayFactor * 0.7
    this.hemi.intensity = 0.8 + dayFactor * 0.7

    // Sky uniforms
    this.skyMat.uniforms.uSunDir.value.set(sx, sy, sz).normalize()
    this.skyMat.uniforms.uSunElevation.value = this.sunElevation
    this.skyMat.uniforms.uTime.value = t
    // horizon color shift by day/sunset
    const horizon = new THREE.Color().lerpColors(
      new THREE.Color('#c9772e'), // day butterscotch
      new THREE.Color('#3a2a4a'), // night dusty purple
      1 - dayFactor
    )
    this.skyMat.uniforms.uHorizonColor.value.copy(horizon)
    this.skyMat.uniforms.uTopColor.value.lerpColors(
      new THREE.Color('#5a3a1a'),
      new THREE.Color('#0a0a14'),
      1 - dayFactor
    )
    // fog color follows horizon
    ;(this.scene.fog as THREE.Fog).color.copy(horizon)
    this.renderer.setClearColor(horizon, 1)

    // Dust
    this.dustMat.uniforms.uTime.value = t
    this.dust.position.set(this.roverPos.x, 0, this.roverPos.z)
    this.dustMat.uniforms.uOpacity.value = 0.35 + (1 - dayFactor) * 0.2

    // ===== AI / control =====
    let moveSpeed = 0
    let moveTurn = 0
    if (this.controlMode === 'autonomous') {
      this.ai.update(dt)
      this.ai.updateLidar(dt, this.raycaster, this.terrain.mesh)
      moveSpeed = this.ai.desired.speed
      moveTurn = this.ai.desired.turn
      // science commands from AI
      if (this.ai.command.kind !== 'none' && !this.science.isActive()) {
        const cmd = this.ai.command
        let poi = null
        if (cmd.kind !== 'weather') {
          poi = this.ai.getTarget() as any
        }
        this.runScience(cmd, poi)
      }
    } else {
      // manual control
      const fwd = (this.keys['w'] || this.keys['arrowup'] ? 1 : 0) - (this.keys['s'] || this.keys['arrowdown'] ? 1 : 0)
      const st = (this.keys['a'] || this.keys['arrowleft'] ? 1 : 0) - (this.keys['d'] || this.keys['arrowright'] ? 1 : 0)
      moveSpeed = fwd * 2.2
      moveTurn = st * 1.2
      this.ai.updateLidar(dt, this.raycaster, this.terrain.mesh)
    }

    // ===== Integrate rover kinematics =====
    this.roverHeading += moveTurn * dt
    const fwd = new THREE.Vector3(Math.sin(this.roverHeading), 0, Math.cos(this.roverHeading))
    const nextX = this.roverPos.x + fwd.x * moveSpeed * dt
    const nextZ = this.roverPos.z + fwd.z * moveSpeed * dt
    // clamp to bounds
    const clampedX = THREE.MathUtils.clamp(nextX, -WORLD_BOUNDS, WORLD_BOUNDS)
    const clampedZ = THREE.MathUtils.clamp(nextZ, -WORLD_BOUNDS, WORLD_BOUNDS)
    this.roverPos.x = clampedX
    this.roverPos.z = clampedZ
    this.roverPos.y = this.terrain.getHeight(this.roverPos.x, this.roverPos.z)
    this.roverSpeed = moveSpeed
    this.rover.setPosition(this.roverPos.x, this.roverPos.z, this.roverHeading)

    // Slope for telemetry
    const slope = this.terrain.getSlope(this.roverPos.x, this.roverPos.z)

    // Update rover model
    this.rover.update(dt, this.terrain, moveSpeed, moveTurn, this.sunElevation)

    // ===== Power management =====
    const drain = (this.science.isActive() ? 1.6 : 0) + Math.abs(moveSpeed) * 0.5 + 0.25
    const charge = Math.max(0, this.sunElevation) * 2.2
    this.power = THREE.MathUtils.clamp(this.power + (charge - drain) * dt, 0, 100)

    // ===== Science update =====
    if (this.science.isActive()) {
      const tip = this.rover.getArmTipWorld(new THREE.Vector3())
      this.science.update(dt, tip)
    }

    // Effects
    this.updateEffects(dt)

    // ===== Camera =====
    this.updateCamera(dt)

    // ===== Telemetry / store pushes (throttled) =====
    this.telAccum += dt
    if (this.telAccum > 0.1) {
      this.telAccum = 0
      const led = this.computeLed()
      store.setTelemetry({
        power: this.power,
        motorRPM: Math.abs(moveSpeed) * 240,
        internalTemp: -42 + (1 - dayFactor) * -8 + Math.abs(moveSpeed) * 4,
        heading: (this.roverHeading * 180) / Math.PI,
        posX: this.roverPos.x,
        posZ: this.roverPos.z,
        posY: this.roverPos.y,
        altitude: this.roverPos.y,
        speed: Math.abs(moveSpeed),
        slope: (slope * 180) / Math.PI,
        led,
        storageUsed: store.telemetry.storageUsed + (this.science.isActive() ? 0.002 : 0),
      })
      this.rover.setLED(led)
    }

    // Environment
    this.envAccum += dt
    if (this.envAccum > 0.5) {
      this.envAccum = 0
      const baseTemp = -63 + Math.sin(solarTime / 24 * Math.PI * 2) * 18
      const temp = baseTemp + (noise2D(t * 0.05, 0) * 3)
      const pressure = 610 + Math.sin(t * 0.1) * 6 + (fbm(t * 0.02, 1) * 4)
      const windSpeed = 8 + Math.abs(fbm(t * 0.05, 0.5)) * 22
      const windDir = (230 + Math.sin(t * 0.04) * 60) % 360
      const uvIndex = Math.max(0, this.sunElevation) * 7
      store.setEnvironment({
        temp,
        pressure,
        windSpeed,
        windDir,
        uvIndex,
        solarTime,
        dustOpacity: 0.5 + (1 - dayFactor) * 0.2,
      })
    }

    // Weather history
    this.weatherAccum += dt
    if (this.weatherAccum > 4) {
      this.weatherAccum = 0
      const env = store.environment
      store.pushWeather({ t: Date.now(), temp: env.temp, pressure: env.pressure, wind: env.windSpeed })
    }

    // Minimap
    this.minimapAccum += dt
    if (this.minimapAccum > 0.12) {
      this.minimapAccum = 0
      store.setMiniMap({
        rover: { x: this.roverPos.x, z: this.roverPos.z, heading: this.roverHeading },
        path: store.path,
        target: store.target,
        obstacles: this.terrain.obstacles,
        pois: store.pois,
      })
    }

    // FPS
    this.fpsFrames++
    this.fpsTime += dt
    if (this.fpsTime > 0.5) {
      store.setFps(Math.round(this.fpsFrames / this.fpsTime))
      this.fpsFrames = 0
      this.fpsTime = 0
    }

    // Render
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private computeLed(): 'green' | 'amber' | 'red' {
    const st = useMarsStore.getState().telemetry.aiStatus
    if (this.power < 20) return 'red'
    if (this.science.isActive()) return 'amber'
    if (st === 'HAZARD' || st === 'LOW_POWER') return 'red'
    if (st === 'NAVIGATE' || st === 'IDLE' || st === 'SURVEY' || st === 'PATHFIND') return 'green'
    return 'amber'
  }

  private _camTmp = new THREE.Vector3()
  private updateCamera(dt: number) {
    const lerp = 1 - Math.pow(0.001, dt)
    if (this.camMode === 'orbital') {
      this.controls.target.lerp(this._camTmp.copy(this.roverPos).add(new THREE.Vector3(0, 1, 0)), lerp * 0.6)
      return
    }
    if (this.camMode === 'follow') {
      const behind = new THREE.Vector3(
        this.roverPos.x - Math.sin(this.roverHeading) * 9,
        this.roverPos.y + 5.5,
        this.roverPos.z - Math.cos(this.roverHeading) * 9
      )
      this.camera.position.lerp(behind, lerp)
      this.camera.lookAt(this.roverPos.x, this.roverPos.y + 1.5, this.roverPos.z)
    } else if (this.camMode === 'navcam') {
      const mast = this.rover.getMastWorldPosition(new THREE.Vector3())
      const dir = this.rover.getForward(new THREE.Vector3())
      this.camera.position.lerp(mast, lerp)
      const tgt = new THREE.Vector3().copy(mast).add(dir.multiplyScalar(10))
      this.camera.lookAt(tgt)
      // wide FOV for navcam
      if (Math.abs(this.camera.fov - 80) > 1) {
        this.camera.fov = 80
        this.camera.updateProjectionMatrix()
      }
    } else if (this.camMode === 'armcam') {
      const tip = this.rover.getArmTipWorld(new THREE.Vector3())
      this.camera.position.lerp(tip.clone().add(new THREE.Vector3(0.6, 0.6, 0.6)), lerp)
      this.camera.lookAt(tip)
      if (this.camera.fov !== 55) {
        this.camera.fov = 55
        this.camera.updateProjectionMatrix()
      }
    }
    // reset fov for follow
    if (this.camMode === 'follow' && this.camera.fov !== 55) {
      this.camera.fov = 55
      this.camera.updateProjectionMatrix()
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKey)
    this.controls.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const m = mesh.material
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose())
      else if (m) (m as THREE.Material).dispose()
    })
  }
}
