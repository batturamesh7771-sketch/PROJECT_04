import { create } from 'zustand'

export type CameraMode = 'follow' | 'navcam' | 'armcam' | 'orbital'
export type ControlMode = 'autonomous' | 'manual'
export type LedState = 'green' | 'amber' | 'red'
export type AIState =
  | 'IDLE'
  | 'SURVEY'
  | 'PATHFIND'
  | 'NAVIGATE'
  | 'DRILL'
  | 'SPECTRO'
  | 'WEATHER'
  | 'BIOSIGNATURE'
  | 'LOW_POWER'
  | 'HAZARD'

export interface Vec2 {
  x: number
  z: number
}

export interface Telemetry {
  power: number
  motorRPM: number
  internalTemp: number
  storageUsed: number
  storageTotal: number
  aiStatus: AIState
  led: LedState
  speed: number
  heading: number
  posX: number
  posZ: number
  posY: number
  altitude: number
  slope: number
}

export interface EnvironmentData {
  temp: number
  pressure: number
  windSpeed: number
  windDir: number
  uvIndex: number
  solarTime: number // 0..24
  dustOpacity: number
}

export interface Obstacle {
  x: number
  z: number
  r: number
  kind: 'boulder' | 'crater' | 'steep'
}

export interface POI {
  id: string
  x: number
  z: number
  type: 'anomalous-rock' | 'drill-site' | 'ice-deposit' | 'scientific'
  name: string
  analyzed: boolean
  confidence: number
}

export interface LogEntry {
  id: number
  t: number
  level: 'info' | 'warn' | 'ok' | 'ai'
  msg: string
}

export interface Stratum {
  name: string
  color: string
  depth: number // meters
  desc: string
}

export interface DrillResult {
  active: boolean
  progress: number
  depth: number
  maxDepth: number
  strata: Stratum[]
  discoveredWater: boolean
}

export interface ElementReading {
  symbol: string
  name: string
  pct: number
  color: string
}

export interface SpectroResult {
  active: boolean
  progress: number
  sample: string
  elements: ElementReading[]
}

export interface WeatherHistory {
  t: number
  temp: number
  pressure: number
  wind: number
}

export interface BiosignatureResult {
  active: boolean
  progress: number
  findings: { name: string; confidence: number; type: string }[]
  detectedOrganics: boolean
}

export interface MiniMapData {
  rover: { x: number; z: number; heading: number }
  path: Vec2[]
  target: Vec2 | null
  obstacles: Obstacle[]
  pois: POI[]
  lidarSweep: number
  bounds: number
}

interface MarsState {
  ready: boolean
  telemetry: Telemetry
  environment: EnvironmentData
  obstacles: Obstacle[]
  pois: POI[]
  logs: LogEntry[]
  path: Vec2[]
  drill: DrillResult
  spectro: SpectroResult
  weatherHistory: WeatherHistory[]
  biosignature: BiosignatureResult
  miniMap: MiniMapData
  cameraMode: CameraMode
  controlMode: ControlMode
  fps: number
  target: Vec2 | null

  setReady: (v: boolean) => void
  setTelemetry: (t: Partial<Telemetry>) => void
  setEnvironment: (e: Partial<EnvironmentData>) => void
  setObstacles: (o: Obstacle[]) => void
  setPois: (p: POI[]) => void
  updatePoi: (id: string, patch: Partial<POI>) => void
  addLog: (level: LogEntry['level'], msg: string) => void
  clearLogs: () => void
  setPath: (p: Vec2[]) => void
  setDrill: (d: Partial<DrillResult>) => void
  setSpectro: (s: Partial<SpectroResult>) => void
  setBiosignature: (b: Partial<BiosignatureResult>) => void
  pushWeather: (w: WeatherHistory) => void
  setMiniMap: (m: Partial<MiniMapData>) => void
  setCameraMode: (c: CameraMode) => void
  setControlMode: (c: ControlMode) => void
  setFps: (f: number) => void
  setTarget: (t: Vec2 | null) => void
}

let logId = 0

export const initialStrata: Stratum[] = [
  { name: 'Regolith', color: '#C1440E', depth: 0.4, desc: 'Fine iron-oxide dust' },
  { name: 'Iron Oxides', color: '#8B0000', depth: 1.1, desc: 'Hematite-rich layer' },
  { name: 'Silicate', color: '#6b4226', depth: 1.9, desc: 'Basaltic silicate rock' },
  { name: 'Permafrost', color: '#9fd8ff', depth: 2.6, desc: 'Subsurface water ice' },
]

export const useMarsStore = create<MarsState>((set) => ({
  ready: false,
  telemetry: {
    power: 100,
    motorRPM: 0,
    internalTemp: -42,
    storageUsed: 12.4,
    storageTotal: 64,
    aiStatus: 'IDLE',
    led: 'green',
    speed: 0,
    heading: 0,
    posX: 0,
    posZ: 0,
    posY: 0,
    altitude: 0,
    slope: 0,
  },
  environment: {
    temp: -63,
    pressure: 610,
    windSpeed: 12,
    windDir: 230,
    uvIndex: 5,
    solarTime: 9.5,
    dustOpacity: 0.6,
  },
  obstacles: [],
  pois: [],
  logs: [],
  path: [],
  drill: {
    active: false,
    progress: 0,
    depth: 0,
    maxDepth: 2.6,
    strata: initialStrata,
    discoveredWater: false,
  },
  spectro: {
    active: false,
    progress: 0,
    sample: '—',
    elements: [],
  },
  weatherHistory: [],
  biosignature: {
    active: false,
    progress: 0,
    findings: [],
    detectedOrganics: false,
  },
  miniMap: {
    rover: { x: 0, z: 0, heading: 0 },
    path: [],
    target: null,
    obstacles: [],
    pois: [],
    lidarSweep: 0,
    bounds: 120,
  },
  cameraMode: 'follow',
  controlMode: 'autonomous',
  fps: 60,
  target: null,

  setReady: (v) => set({ ready: v }),
  setTelemetry: (t) => set((s) => ({ telemetry: { ...s.telemetry, ...t } })),
  setEnvironment: (e) => set((s) => ({ environment: { ...s.environment, ...e } })),
  setObstacles: (o) => set({ obstacles: o }),
  setPois: (p) => set({ pois: p }),
  updatePoi: (id, patch) =>
    set((s) => ({ pois: s.pois.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  addLog: (level, msg) =>
    set((s) => ({
      logs: [...s.logs.slice(-80), { id: logId++, t: Date.now(), level, msg }].slice(-120),
    })),
  clearLogs: () => set({ logs: [] }),
  setPath: (p) => set({ path: p }),
  setDrill: (d) => set((s) => ({ drill: { ...s.drill, ...d } })),
  setSpectro: (sp) => set((s) => ({ spectro: { ...s.spectro, ...sp } })),
  setBiosignature: (b) => set((s) => ({ biosignature: { ...s.biosignature, ...b } })),
  pushWeather: (w) =>
    set((s) => ({ weatherHistory: [...s.weatherHistory.slice(-59), w] })),
  setMiniMap: (m) => set((s) => ({ miniMap: { ...s.miniMap, ...m } })),
  setCameraMode: (c) => set({ cameraMode: c }),
  setControlMode: (c) => set({ controlMode: c }),
  setFps: (f) => set({ fps: f }),
  setTarget: (t) => set({ target: t }),
}))
