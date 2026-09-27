import * as THREE from 'three'
import type { TerrainData } from './terrain'
import type { LedState } from './store'

const LED_COLORS: Record<LedState, string> = {
  green: '#36e06a',
  amber: '#ffb627',
  red: '#ff3b3b',
}

interface Wheel {
  mesh: THREE.Mesh
  steer: THREE.Object3D // steering pivot (for front wheels)
  localPos: THREE.Vector3
  radius: number
  spin: number
}

export class RoverModel {
  group: THREE.Group
  body: THREE.Group
  mast: THREE.Object3D
  lidarHead: THREE.Object3D
  arm: THREE.Group
  armTip: THREE.Object3D
  drill: THREE.Object3D
  scanner: THREE.Object3D
  solarPanels: THREE.Object3D[]
  headlight: THREE.SpotLight
  ledMeshes: THREE.Mesh[]
  navCamL: THREE.Object3D
  navCamR: THREE.Object3D
  mastCam: THREE.Object3D

  private wheels: Wheel[] = []
  private pos = new THREE.Vector3(0, 0, 0)
  private heading = 0 // radians, 0 = facing +Z
  private speed = 0
  private turn = 0
  private bodyTilt = new THREE.Vector3()
  private ledState: LedState = 'green'
  private armDeploy = 0 // 0..1
  private drilling = false
  private armTargetDeploy = 0

  // scratch
  private _v = new THREE.Vector3()
  private _v2 = new THREE.Vector3()
  private _q = new THREE.Quaternion()
  private _e = new THREE.Euler()
  private _m = new THREE.Matrix4()
  private _up = new THREE.Vector3(0, 1, 0)
  private _fwd = new THREE.Vector3(0, 0, 1)
  private _right = new THREE.Vector3(1, 0, 0)
  private _n = new THREE.Vector3()

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'rover'
    this.body = new THREE.Group()
    this.group.add(this.body)
    this.mast = new THREE.Object3D()
    this.solarPanels = []
    this.ledMeshes = []

    this.buildChassis()
    this.buildSolarPanels()
    this.buildAntenna()
    this.buildMast()
    this.buildArm()
    this.buildWheels()
    this.buildLights()

    this.group.position.set(0, 0, 0)
  }

  private metalMat(color: string, rough = 0.5, metal = 0.7) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  }
  private darkMat(rough = 0.6) {
    return new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: rough, metalness: 0.6 })
  }

  private buildChassis() {
    // Main body box
    const bodyMat = this.metalMat('#b8b8c0', 0.45, 0.75)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), bodyMat)
    body.position.y = 0.55
    body.castShadow = true
    body.receiveShadow = true
    this.body.add(body)

    // Lower deck (electronics box)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.9), this.metalMat('#8a8a96', 0.5, 0.7))
    deck.position.y = 0.28
    deck.castShadow = true
    this.body.add(deck)

    // Radiator fins (gold foil look)
    const foilMat = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.35, metalness: 0.9 })
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.6), foilMat)
      fin.position.set(0.78 - i * 0.0, 0.55, 0)
      // place along side
    }
    // Side gold panel
    const sidePanel1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.8), foilMat)
    sidePanel1.position.set(0.86, 0.55, 0)
    this.body.add(sidePanel1)
    const sidePanel2 = sidePanel1.clone()
    sidePanel2.position.x = -0.86
    this.body.add(sidePanel2)

    // Front bumper + headlights housing
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.2), this.darkMat())
    bumper.position.set(0, 0.4, 1.15)
    this.body.add(bumper)
  }

  private buildSolarPanels() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: '#1a2b5a',
      roughness: 0.25,
      metalness: 0.4,
      emissive: '#0a1838',
      emissiveIntensity: 0.15,
    })
    const frameMat = this.metalMat('#6a6a72', 0.5, 0.7)
    // Three panel segments on top
    const layout = [
      { x: 0, z: 0.7, w: 1.5, d: 0.5 },
      { x: 0, z: 0, w: 1.5, d: 0.5 },
      { x: 0, z: -0.7, w: 1.5, d: 0.5 },
    ]
    for (const l of layout) {
      const grp = new THREE.Object3D()
      const frame = new THREE.Mesh(new THREE.BoxGeometry(l.w + 0.08, 0.04, l.d + 0.08), frameMat)
      frame.castShadow = true
      const panel = new THREE.Mesh(new THREE.BoxGeometry(l.w, 0.05, l.d), panelMat)
      panel.position.y = 0.01
      grp.add(frame, panel)
      grp.position.set(l.x, 0.86, l.z)
      this.body.add(grp)
      this.solarPanels.push(grp)
    }
  }

  private buildAntenna() {
    // High-gain antenna: mast + parabolic dish
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 1.1, 8),
      this.darkMat()
    )
    mast.position.set(-0.5, 1.45, -0.6)
    this.body.add(mast)
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
      this.metalMat('#d8d8e0', 0.3, 0.85)
    )
    dish.rotation.x = -Math.PI * 0.18
    dish.position.set(-0.5, 2.0, -0.6)
    this.body.add(dish)
    const feed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6),
      this.darkMat()
    )
    feed.position.set(-0.5, 2.12, -0.6)
    this.body.add(feed)

    // Low-gain stick antenna
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), this.darkMat())
    lg.position.set(0.6, 1.25, -0.8)
    lg.rotation.z = 0.3
    this.body.add(lg)
  }

  private buildMast() {
    // Sensor mast: tall column at front of body
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.4, 10),
      this.metalMat('#c8c8d0', 0.4, 0.8)
    )
    col.position.set(0, 1.55, 0.8)
    col.castShadow = true
    this.body.add(col)
    this.mast = col

    // Mast head (camera head) — rotates for pan
    const head = new THREE.Object3D()
    head.position.set(0, 2.25, 0.8)
    this.body.add(head)
    this.lidarHead = head

    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.32), this.metalMat('#e0e0e8', 0.35, 0.8))
    head.add(headBox)

    // NavCams (stereo) — two small lenses front
    const camMat = this.darkMat(0.2)
    const lensMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.1, metalness: 0.9 })
    for (const sx of [-0.13, 0.13]) {
      const cam = new THREE.Object3D()
      cam.position.set(sx, 0.02, 0.18)
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), camMat)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), lensMat)
      lens.rotation.x = Math.PI / 2
      lens.position.z = 0.05
      cam.add(housing, lens)
      head.add(cam)
      if (sx < 0) this.navCamL = cam
      else this.navCamR = cam
    }
    // MastCam (bigger lens) center top
    const mastCam = new THREE.Object3D()
    mastCam.position.set(0, 0.16, 0.12)
    const mHousing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), camMat)
    const mLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), lensMat)
    mLens.rotation.x = Math.PI / 2
    mLens.position.z = 0.06
    mastCam.add(mHousing, mLens)
    head.add(mastCam)
    this.mastCam = mastCam

    // LIDAR rotating puck on top of head
    const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), this.metalMat('#2a2a30', 0.3, 0.8))
    lidar.position.y = 0.24
    head.add(lidar)

    // Status LEDs on the mast head
    for (let i = 0; i < 3; i++) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#36e06a' })
      )
      led.position.set(-0.2 + i * 0.2, -0.18, 0.17)
      head.add(led)
      this.ledMeshes.push(led)
    }
  }

  private buildArm() {
    // Robotic arm with shoulder, elbow, wrist + end-effector (drill, scanner, container)
    this.arm = new THREE.Group()
    this.arm.position.set(0.55, 0.9, 0.4)
    this.body.add(this.arm)

    const armMat = this.metalMat('#d0d0d8', 0.35, 0.85)
    const segMat = this.metalMat('#9a9aa4', 0.4, 0.8)

    // Shoulder joint
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14), armMat)
    shoulder.rotation.z = Math.PI / 2
    this.arm.add(shoulder)

    // Upper arm
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), segMat)
    upper.position.y = 0.45
    upper.castShadow = true
    const upperPivot = new THREE.Object3D()
    upperPivot.add(upper)
    this.arm.add(upperPivot)
    upperPivot.position.y = 0.05

    // Elbow
    const elbow = new THREE.Object3D()
    elbow.position.y = 0.9
    upperPivot.add(elbow)
    const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12), armMat)
    elbowJoint.rotation.z = Math.PI / 2
    elbow.add(elbowJoint)

    // Forearm
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), segMat)
    forearm.position.y = 0.35
    forearm.castShadow = true
    elbow.add(forearm)

    // Wrist
    const wrist = new THREE.Object3D()
    wrist.position.y = 0.7
    elbow.add(wrist)
    const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), armMat)
    wrist.add(wristJoint)

    // End-effector turret with tools
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 12), this.darkMat(0.4))
    turret.rotation.x = Math.PI / 2
    turret.position.z = 0.18
    wrist.add(turret)

    // Drill bit
    const drill = new THREE.Object3D()
    const drillShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.015, 0.4, 10),
      this.metalMat('#c8a040', 0.3, 0.9)
    )
    const drillTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.1, 8),
      this.metalMat('#e8e8f0', 0.2, 0.95)
    )
    drillTip.position.y = -0.25
    drill.add(drillShaft, drillTip)
    drill.rotation.x = Math.PI / 2
    drill.position.set(0, -0.02, 0.4)
    wrist.add(drill)
    this.drill = drill

    // Spectral scanner (small box with lens)
    const scanner = new THREE.Object3D()
    const sBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), this.darkMat())
    const sLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12),
      new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.1, metalness: 0.9 })
    )
    sLens.rotation.x = Math.PI / 2
    sLens.position.z = 0.09
    scanner.add(sBox, sLens)
    scanner.position.set(0.12, 0.04, 0.32)
    scanner.rotation.x = Math.PI / 2
    wrist.add(scanner)
    this.scanner = scanner

    // Sample collection container
    const container = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12),
      this.metalMat('#a88030', 0.4, 0.85)
    )
    container.position.set(-0.12, 0.04, 0.32)
    container.rotation.x = Math.PI / 2
    wrist.add(container)

    // Arm tip reference (drill tip world position)
    this.armTip = drill

    // Store joint refs on arm for animation
    this.arm.userData.upper = upperPivot
    this.arm.userData.elbow = elbow
    this.arm.userData.wrist = wrist
  }

  private buildWheels() {
    const wheelMat = this.metalMat('#1a1a1d', 0.9, 0.3)
    const hubMat = this.metalMat('#888892', 0.5, 0.8)
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 18)
    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10)
    // spoke pattern via extra ring
    const treadGeo = new THREE.TorusGeometry(0.34, 0.03, 6, 18)

    // Wheel local positions (body space). Forward = +Z
    const positions: { x: number; z: number; front: boolean }[] = [
      { x: 0.78, z: 0.95, front: true }, // FL
      { x: -0.78, z: 0.95, front: true }, // FR
      { x: 0.82, z: 0.0, front: false }, // ML
      { x: -0.82, z: 0.0, front: false }, // MR
      { x: 0.78, z: -0.95, front: false }, // RL
      { x: -0.78, z: -0.95, front: false }, // RR
    ]

    for (const p of positions) {
      const steer = new THREE.Object3D()
      steer.position.set(p.x, 0.0, p.z)
      this.body.add(steer)
      // suspension arm visual (bogie bar) — simple cylinder from steer to body center
      const armLen = Math.sqrt(p.x * p.x + p.z * p.z)
      const suspArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, armLen),
        this.metalMat('#5a5a64', 0.5, 0.7)
      )
      suspArm.position.set(-p.x / 2, 0.05, -p.z / 2)
      suspArm.lookAt(new THREE.Vector3(p.x, 0.05, p.z))
      this.body.add(suspArm)

      const wheel = new THREE.Mesh(wheelGeo, wheelMat)
      wheel.castShadow = true
      wheel.rotation.z = Math.PI / 2
      wheel.position.y = -0.05
      const hub = new THREE.Mesh(hubGeo, hubMat)
      hub.rotation.z = Math.PI / 2
      wheel.add(hub)
      const tread = new THREE.Mesh(treadGeo, this.darkMat(0.8))
      tread.rotation.y = Math.PI / 2
      wheel.add(tread)
      steer.add(wheel)

      this.wheels.push({
        mesh: wheel,
        steer,
        localPos: new THREE.Vector3(p.x, 0, p.z),
        radius: 0.34,
        spin: 0,
      })
    }
  }

  private buildLights() {
    // Headlight spotlight at front
    const headlight = new THREE.SpotLight('#fff6dc', 6, 22, Math.PI / 6, 0.4, 1.2)
    headlight.position.set(0, 0.7, 1.0)
    headlight.target.position.set(0, 0.2, 6)
    this.body.add(headlight)
    this.body.add(headlight.target)
    this.headlight = headlight

    // Headlight lens visuals
    for (const sx of [-0.35, 0.35]) {
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 16),
        new THREE.MeshBasicMaterial({ color: '#fff6dc' })
      )
      lens.position.set(sx, 0.45, 1.12)
      this.body.add(lens)
    }
  }

  setLED(state: LedState) {
    this.ledState = state
    const c = LED_COLORS[state]
    for (const m of this.ledMeshes) {
      ;(m.material as THREE.MeshBasicMaterial).color.set(c)
    }
  }

  getLED() {
    return this.ledState
  }

  setArmDeploy(v: number) {
    this.armTargetDeploy = v
  }

  setDrilling(v: boolean) {
    this.drilling = v
  }

  setPosition(x: number, z: number, heading: number) {
    this.pos.set(x, 0, z)
    this.heading = heading
  }

  getPos() {
    return this.pos.clone()
  }
  getHeading() {
    return this.heading
  }

  // Forward direction in world space
  getForward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading))
  }

  getMastWorldPosition(out = new THREE.Vector3()) {
    this.mast.getWorldPosition(out)
    out.y += 0.8
    return out
  }

  getNavCamWorld(out = new THREE.Vector3(), lookDir = new THREE.Vector3()) {
    this.navCamL.getWorldPosition(out)
    this.getForward(lookDir)
    return { pos: out, dir: lookDir }
  }

  getArmTipWorld(out = new THREE.Vector3()) {
    this.armTip.getWorldPosition(out)
    return out
  }

  // Main per-frame update. dt seconds, terrain for height, moving flags.
  update(dt: number, terrain: TerrainData, speed: number, turnRate: number, sunElev: number) {
    this.speed = speed
    this.turn = turnRate
    this.heading += turnRate * dt

    const fwd = this.getForward(this._fwd)
    const right = this._right.crossVectors(this._up, fwd).normalize()

    // Compute each wheel's ground contact & align
    const wheelHeights: number[] = []
    const wheelNormals: THREE.Vector3[] = []
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i]
      // world position of wheel contact (local pos rotated by heading)
      const lx = w.localPos.x
      const lz = w.localPos.z
      const wx = this.pos.x + right.x * lx + fwd.x * lz
      const wz = this.pos.z + right.z * lx + fwd.z * lz
      const gy = terrain.getHeight(wx, wz)
      wheelHeights.push(gy)
      wheelNormals.push(terrain.getNormal(wx, wz).clone())

      // Place wheel mesh y so its center sits radius above ground
      w.steer.position.y = gy + w.radius - 0.05 // body-relative y; body itself will be lifted
      // Steer front wheels
      if (w.localPos.z > 0.5) {
        w.steer.rotation.y = THREE.MathUtils.clamp(turnRate * 6, -0.5, 0.5)
      } else {
        w.steer.rotation.y = 0
      }
      // Spin wheels
      w.spin += (speed / w.radius) * dt
      w.mesh.rotation.x = w.spin
    }

    // Body height = average wheel ground height + body offset
    const avgGround =
      wheelHeights.reduce((a, b) => a + b, 0) / wheelHeights.length
    const bodyY = avgGround + 0.55

    // Body orientation: align up to average terrain normal, blended with forward
    const avgN = this._n.set(0, 0, 0)
    for (const nrm of wheelNormals) avgN.add(nrm)
    avgN.normalize()

    // Build rotation: forward tilted onto terrain plane, up = avgN
    // Project forward onto plane defined by avgN
    const fwdOnPlane = fwd.clone().sub(avgN.clone().multiplyScalar(fwd.dot(avgN))).normalize()
    const rightOnPlane = new THREE.Vector3().crossVectors(avgN, fwdOnPlane).normalize()
    this._m.makeBasis(rightOnPlane, avgN, fwdOnPlane)
    this._q.setFromRotationMatrix(this._m)
    this.body.quaternion.copy(this._q)

    // Position the whole group; body y handled via group
    this.group.position.set(this.pos.x, 0, this.pos.z)
    // Body sits at bodyY (wheel meshes placed relative to body already at ground, so lift body by avgGround)
    this.body.position.y = avgGround
    // Apply heading by rotating body? We baked fwd into quaternion already using heading, so no extra yaw needed.
    // But wheel local positions used right/fwd from heading — consistent.

    // LIDAR head continuous rotation
    this.lidarHead.rotation.y += dt * 1.6

    // Arm deploy animation
    const target = this.armTargetDeploy
    this.armDeploy += (target - this.armDeploy) * Math.min(1, dt * 2.5)
    const upper = this.arm.userData.upper as THREE.Object3D
    const elbow = this.arm.userData.elbow as THREE.Object3D
    const wrist = this.arm.userData.wrist as THREE.Object3D
    const d = this.armDeploy
    // Deployed arm reaches down toward ground in front
    upper.rotation.x = THREE.MathUtils.lerp(0.2, 1.1, d)
    elbow.rotation.x = THREE.MathUtils.lerp(-0.2, 0.9, d)
    wrist.rotation.x = THREE.MathUtils.lerp(0, -0.6, d)

    // Drill spin when drilling
    if (this.drilling) {
      this.drill.rotation.y += dt * 25
    }

    // Headlight intensity depends on sun elevation (brighter when low sun)
    this.headlight.intensity = THREE.MathUtils.clamp(2 + (1 - sunElev) * 8, 2, 10)
  }
}
