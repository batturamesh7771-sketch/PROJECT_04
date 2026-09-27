import * as THREE from 'three'
import type { TerrainData } from './terrain'
import type { AIState, POI, Vec2 } from './store'
import { useMarsStore } from './store'

// Coarse navigation grid for A* over the bounded map.
const GRID_CELL = 3 // meters per cell
const GRID_HALF = 60 // cells from center => 120m x 120m navigable
const GRID_N = GRID_HALF * 2

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

interface NavCell {
  walkable: boolean
}

export interface AIMoveCommand {
  speed: number // m/s
  turn: number // rad/s
}

export type AIScienceCommand =
  | { kind: 'drill'; poiId: string }
  | { kind: 'spectro'; poiId: string }
  | { kind: 'weather' }
  | { kind: 'biosignature'; poiId: string }
  | { kind: 'none' }

export class AIEngine {
  state: AIState = 'IDLE'
  private terrain: TerrainData
  private grid: NavCell[] = []
  private target: POI | null = null
  private path: Vec2[] = []
  private pathIndex = 0
  private replanTimer = 0
  private thinkTimer = 0
  private lidarAngle = 0
  private powerRecovery = false
  private taskCooldown = 0
  private commandedScience: AIScienceCommand = { kind: 'none' }

  // Outputs consumed by the scene manager
  desired: AIMoveCommand = { speed: 0, turn: 0 }
  command: AIScienceCommand = { kind: 'none' }

  // Rover state accessor (owned by scene manager)
  getPos: () => THREE.Vector3
  getHeading: () => number
  getPower: () => number

  constructor(
    terrain: TerrainData,
    getPos: () => THREE.Vector3,
    getHeading: () => number,
    getPower: () => number
  ) {
    this.terrain = terrain
    this.getPos = getPos
    this.getHeading = getHeading
    this.getPower = getPower
    this.buildGrid()
  }

  private cellIndex(cx: number, cz: number) {
    return cx + GRID_HALF + (cz + GRID_HALF) * GRID_N
  }
  private worldToCell(x: number, z: number) {
    return {
      cx: Math.round(x / GRID_CELL),
      cz: Math.round(z / GRID_CELL),
    }
  }
  private cellToWorld(cx: number, cz: number): Vec2 {
    return { x: cx * GRID_CELL, z: cz * GRID_CELL }
  }

  private buildGrid() {
    this.grid = new Array(GRID_N * GRID_N).fill(null).map(() => ({ walkable: true }))
    for (let cz = -GRID_HALF; cz < GRID_HALF; cz++) {
      for (let cx = -GRID_HALF; cx < GRID_HALF; cx++) {
        const x = cx * GRID_CELL
        const z = cz * GRID_CELL
        const slope = this.terrain.getSlope(x, z)
        // Mark steep areas unwalkable
        let walkable = slope < 0.42 // ~23deg
        // Mark crater interiors unwalkable
        for (const c of this.terrain.craters) {
          const dx = x - c.x
          const dz = z - c.z
          if (dx * dx + dz * dz < (c.r * 0.8) ** 2) {
            walkable = false
            break
          }
        }
        // Guarantee a walkable spawn corridor around origin so A* always has
        // an exit route from the landing zone.
        if (Math.sqrt(x * x + z * z) < 18) walkable = true
        this.grid[this.cellIndex(cx, cz)].walkable = walkable
      }
    }
  }

  // A* over the grid from current pos to target cell.
  private findPath(sx: number, sz: number, tx: number, tz: number): Vec2[] {
    const start = this.worldToCell(sx, sz)
    const goal = this.worldToCell(tx, tz)
    if (start.cx === goal.cx && start.cz === goal.cz) return [this.cellToWorld(goal.cx, goal.cz)]

    const open: number[] = [] // indices
    const cameFrom = new Map<number, number>()
    const g = new Map<number, number>()
    const f = new Map<number, number>()
    const idx = (cx: number, cz: number) => this.cellIndex(cx, cz)
    const h = (cx: number, cz: number) => Math.abs(cx - goal.cx) + Math.abs(cz - goal.cz)

    const startIdx = idx(start.cx, start.cz)
    g.set(startIdx, 0)
    f.set(startIdx, h(start.cx, start.cz))
    open.push(startIdx)

    const neighbors = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]

    let iter = 0
    while (open.length && iter < 6000) {
      iter++
      // get lowest f
      let bestI = 0
      for (let i = 1; i < open.length; i++) {
        if ((f.get(open[i]) ?? Infinity) < (f.get(open[bestI]) ?? Infinity)) bestI = i
      }
      const current = open.splice(bestI, 1)[0]
      const ccx = ((current % GRID_N) + GRID_N) % GRID_N - GRID_HALF
      const ccz = Math.floor(current / GRID_N) - GRID_HALF
      if (ccx === goal.cx && ccz === goal.cz) {
        // reconstruct
        const path: Vec2[] = []
        let cur: number | undefined = current
        while (cur !== undefined) {
          const pcx = ((cur % GRID_N) + GRID_N) % GRID_N - GRID_HALF
          const pcz = Math.floor(cur / GRID_N) - GRID_HALF
          path.unshift(this.cellToWorld(pcx, pcz))
          cur = cameFrom.get(cur)
        }
        return path
      }
      for (const [dx, dz] of neighbors) {
        const nx = ccx + dx
        const nz = ccz + dz
        if (nx < -GRID_HALF || nx >= GRID_HALF || nz < -GRID_HALF || nz >= GRID_HALF) continue
        const nIdx = idx(nx, nz)
        if (!this.grid[nIdx].walkable) continue
        // discourage diagonal through unwalkable corners
        if (dx !== 0 && dz !== 0) {
          if (!this.grid[idx(ccx + dx, ccz)].walkable || !this.grid[idx(ccx, ccz + dz)].walkable)
            continue
        }
        const step = dx !== 0 && dz !== 0 ? 1.414 : 1
        const tentative = (g.get(current) ?? Infinity) + step
        if (tentative < (g.get(nIdx) ?? Infinity)) {
          cameFrom.set(nIdx, current)
          g.set(nIdx, tentative)
          f.set(nIdx, tentative + h(nx, nz))
          if (!open.includes(nIdx)) open.push(nIdx)
        }
      }
    }
    return []
  }

  setTarget(poi: POI | null) {
    this.target = poi
    this.path = []
    this.pathIndex = 0
    this.replanTimer = 0
  }

  getTarget() {
    return this.target
  }

  // Triggered by UI manual override
  forceScience(cmd: AIScienceCommand) {
    this.commandedScience = cmd
  }

  // Continuous LIDAR sweep — raycast terrain in a rotating arc, record hits.
  // Returns discovered obstacle/POI updates to feed store minimap.
  updateLidar(dt: number, raycaster: THREE.Raycaster, terrainMesh: THREE.Object3D) {
    this.lidarAngle += dt * 2.4
    const store = useMarsStore.getState()
    const pos = this.getPos()
    const ang = this.lidarAngle
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
    const origin = new THREE.Vector3(pos.x, pos.y + 1.2, pos.z)
    raycaster.set(origin, dir)
    raycaster.far = 40
    const hits = raycaster.intersectObject(terrainMesh, false)
    const sweep = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    store.setMiniMap({ lidarSweep: sweep / (Math.PI * 2) })
    if (hits.length) {
      // distance used for hazard proximity logic in FSM
      this._lastLidarDist = hits[0].distance
      this._lastLidarPoint = hits[0].point
    } else {
      this._lastLidarDist = 40
    }
  }
  private _lastLidarDist = 40
  private _lastLidarPoint: THREE.Vector3 | null = null

  private log(level: 'info' | 'warn' | 'ok' | 'ai', msg: string) {
    useMarsStore.getState().addLog(level, msg)
  }

  // Choose next scientific target POI (nearest un-analyzed).
  private chooseTarget(): POI | null {
    const pois = useMarsStore.getState().pois
    const pos = this.getPos()
    const candidates = pois.filter((p) => !p.analyzed)
    if (candidates.length === 0) {
      // all analyzed -> re-arm some as new (endless mission)
      useMarsStore.getState().setPois(
        pois.map((p) => ({ ...p, analyzed: false, confidence: 60 + Math.floor(Math.random() * 38) }))
      )
      this.log('info', 'Mission cycle complete — re-surveying sites for new anomalies.')
      return null
    }
    candidates.sort((a, b) => {
      const da = (a.x - pos.x) ** 2 + (a.z - pos.z) ** 2
      const db = (b.x - pos.x) ** 2 + (b.z - pos.z) ** 2
      return da - db
    })
    return candidates[0]
  }

  update(dt: number): void {
    this.thinkTimer -= dt
    this.replanTimer -= dt
    this.taskCooldown -= dt
    const store = useMarsStore.getState()
    const power = this.getPower()
    const pos = this.getPos()

    // ====== RESOURCE MANAGEMENT ======
    if (power < 20 && !this.powerRecovery) {
      this.powerRecovery = true
      this.state = 'LOW_POWER'
      this.desired.speed = 0
      this.desired.turn = 0
      this.command = { kind: 'none' }
      this.log('warn', `Battery critically low (${power.toFixed(0)}%). Halting science ops, aligning solar panels to sun.`)
      store.setTelemetry({ aiStatus: 'LOW_POWER', led: 'red' })
      store.setTarget(null)
      this.setTarget(null)
      return
    }
    if (this.powerRecovery && power > 60) {
      this.powerRecovery = false
      this.state = 'IDLE'
      this.log('ok', `Battery recovered to ${power.toFixed(0)}%. Resuming autonomous ops.`)
    }
    if (this.powerRecovery) {
      // hold still, align to sun (turn toward sun azimuth)
      this.desired.speed = 0
      this.command = { kind: 'none' }
      return
    }

    // ====== Manual science command override ======
    if (this.commandedScience.kind !== 'none') {
      this.command = this.commandedScience
      this.commandedScience = { kind: 'none' }
      // run once; scene manager handles progression then resets
      return
    }

    // ====== FSM THINK ======
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.5
      switch (this.state) {
        case 'IDLE':
          this.state = 'SURVEY'
          store.setTelemetry({ aiStatus: 'SURVEY', led: 'amber' })
          this.log('ai', 'SURVEY: Initiating LIDAR terrain scan for obstacles & targets.')
          break
        case 'SURVEY':
          // pick a target after surveying
          const tgt = this.chooseTarget()
          if (tgt) {
            this.setTarget(tgt)
            this.state = 'PATHFIND'
            store.setTelemetry({ aiStatus: 'PATHFIND', led: 'amber' })
            store.setTarget({ x: tgt.x, z: tgt.z })
            this.log(
              'ai',
              `Target detected at (${tgt.x.toFixed(1)}, ${tgt.z.toFixed(1)}) | Type: ${tgt.name} | Confidence: ${tgt.confidence}%`
            )
            this.log('ai', 'PATHFIND: Computing A* route avoiding craters & >23° slopes.')
          } else {
            this.state = 'IDLE'
          }
          break
        case 'PATHFIND':
          if (this.target) {
            this.path = this.findPath(pos.x, pos.z, this.target.x, this.target.z)
            this.pathIndex = 1 // skip current cell
            store.setPath(this.path)
            if (this.path.length === 0) {
              this.log('warn', `No viable path to target. Selecting alternate.`)
              this.setTarget(null)
              this.state = 'SURVEY'
            } else {
              this.state = 'NAVIGATE'
              store.setTelemetry({ aiStatus: 'NAVIGATE', led: 'green' })
              this.log('ok', `Route computed: ${this.path.length} waypoints. Deploying to target.`)
            }
          } else {
            this.state = 'IDLE'
          }
          break
        case 'NAVIGATE':
          if (!this.target) {
            this.state = 'IDLE'
            break
          }
          // arrived?
          const dx = this.target.x - pos.x
          const dz = this.target.z - pos.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < 2.4) {
            this.desired.speed = 0
            this.desired.turn = 0
            // choose science based on POI type
            const t = this.target
            let cmd: AIScienceCommand = { kind: 'drill', poiId: t.id }
            if (t.type === 'ice-deposit') cmd = { kind: 'biosignature', poiId: t.id }
            else if (t.type === 'anomalous-rock') cmd = { kind: 'spectro', poiId: t.id }
            else if (t.type === 'scientific') cmd = { kind: 'drill', poiId: t.id }
            else if (t.type === 'drill-site') cmd = { kind: 'drill', poiId: t.id }
            this.command = cmd
            this.state = this.commandToState(cmd)
            store.setTelemetry({ aiStatus: this.state, led: 'amber' })
            this.log('ai', `Arrived at ${t.name}. Initiating ${this.state} sequence.`)
          }
          break
        case 'DRILL':
        case 'SPECTRO':
        case 'BIOSIGNATURE':
        case 'WEATHER':
          // these are progressed by scene manager; once command resets to none, return to survey
          if (this.command.kind === 'none') {
            if (this.target) {
              store.updatePoi(this.target.id, { analyzed: true })
              this.log('ok', `Analysis complete at ${this.target.name}. Data archived.`)
            }
            this.setTarget(null)
            this.taskCooldown = 2
            this.state = 'IDLE'
            store.setTelemetry({ aiStatus: 'IDLE', led: 'green' })
          }
          break
      }
    }

    // ====== MOVEMENT (NAVIGATE) ======
    if (this.state === 'NAVIGATE' && this.target && this.path.length) {
      // Replan occasionally in case of drift
      if (this.replanTimer <= 0) {
        this.replanTimer = 2.5
        this.path = this.findPath(pos.x, pos.z, this.target.x, this.target.z)
        this.pathIndex = 1
        store.setPath(this.path)
      }
      // advance waypoint
      while (
        this.pathIndex < this.path.length &&
        Math.hypot(this.path[this.pathIndex].x - pos.x, this.path[this.pathIndex].z - pos.z) < 2.0
      ) {
        this.pathIndex++
      }
      if (this.pathIndex >= this.path.length) {
        this.desired.speed = 0
        this.desired.turn = 0
        return
      }
      const wp = this.path[this.pathIndex]
      const desiredHeading = Math.atan2(wp.x - pos.x, wp.z - pos.z)
      let headingErr = desiredHeading - this.getHeading()
      while (headingErr > Math.PI) headingErr -= Math.PI * 2
      while (headingErr < -Math.PI) headingErr += Math.PI * 2

      // HAZARD: LIDAR proximity
      if (this._lastLidarDist < 3.2) {
        this.desired.speed = 0
        this.desired.turn = headingErr > 0 ? -1.2 : 1.2
        if (this.state !== 'HAZARD') {
          this.log('warn', `HAZARD: Obstacle ${this._lastLidarDist.toFixed(1)}m ahead. Evasive turn.`)
          store.setTelemetry({ led: 'red' })
        }
        return
      } else {
        store.setTelemetry({ led: 'green' })
      }

      // Steer toward waypoint; move forward when roughly aligned
      const turn = clamp(headingErr * 2.5, -1.4, 1.4)
      this.desired.turn = turn
      this.desired.speed = Math.abs(headingErr) < 0.5 ? 1.8 : 0.5
    } else {
      this.desired.speed = 0
      this.desired.turn = 0
    }
  }

  private commandToState(cmd: AIScienceCommand): AIState {
    switch (cmd.kind) {
      case 'drill':
        return 'DRILL'
      case 'spectro':
        return 'SPECTRO'
      case 'biosignature':
        return 'BIOSIGNATURE'
      case 'weather':
        return 'WEATHER'
      default:
        return 'IDLE'
    }
  }

  // Scene manager calls this when a science task completes to clear the command.
  clearCommand() {
    this.command = { kind: 'none' }
  }
}
