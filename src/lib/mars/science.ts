import * as THREE from 'three'
import type { AIScienceCommand } from './ai-engine'
import type { ElementReading, POI } from './store'
import { useMarsStore, initialStrata } from './store'

export interface ScienceCallbacks {
  spawnDrillParticles: (pos: THREE.Vector3, intensity: number) => void
  spawnSpectroBeam: (pos: THREE.Vector3) => void
  flashPoi: (poiId: string) => void
}

type TaskKind = 'drill' | 'spectro' | 'weather' | 'biosignature' | null

export class ScienceManager {
  private active: TaskKind = null
  private progress = 0
  private poi: POI | null = null
  private cb: ScienceCallbacks
  private duration = 6
  private drillDepth = 0
  private elements: ElementReading[] = []
  private spectroSample = ''

  constructor(cb: ScienceCallbacks) {
    this.cb = cb
  }

  isActive() {
    return this.active !== null
  }

  start(cmd: AIScienceCommand, poi: POI | null, onComplete: () => void) {
    this.poi = poi
    this.onComplete = onComplete
    switch (cmd.kind) {
      case 'drill':
        this.active = 'drill'
        this.duration = 7
        this.progress = 0
        this.drillDepth = 0
        useMarsStore.getState().setDrill({
          active: true,
          progress: 0,
          depth: 0,
          discoveredWater: false,
          strata: initialStrata,
        })
        useMarsStore.getState().addLog('ai', 'DRILL: Percussive drill engaged. Penetrating regolith.')
        break
      case 'spectro':
        this.active = 'spectro'
        this.duration = 5
        this.progress = 0
        this.spectroSample = this.sampleName(poi)
        this.elements = this.generateElements(poi)
        useMarsStore.getState().setSpectro({
          active: true,
          progress: 0,
          sample: this.spectroSample,
          elements: [],
        })
        useMarsStore.getState().addLog('ai', `SPECTRO: Raman/XRF laser aimed at ${this.spectroSample}. Acquiring spectrum.`)
        break
      case 'biosignature':
        this.active = 'biosignature'
        this.duration = 8
        this.progress = 0
        useMarsStore.getState().setBiosignature({
          active: true,
          progress: 0,
          findings: [],
          detectedOrganics: false,
        })
        useMarsStore.getState().addLog('ai', 'BIOSIG: GC-MS analysis started. Searching for organic carbon compounds.')
        break
      case 'weather':
        this.active = 'weather'
        this.duration = 3
        this.progress = 0
        useMarsStore.getState().addLog('ai', 'WEATHER: Environmental station sampling complete — recording telemetry.')
        break
      default:
        this.active = null
    }
  }

  private onComplete: () => void = () => {}

  private sampleName(poi: POI | null) {
    if (!poi) return 'Surface Regolith'
    switch (poi.type) {
      case 'anomalous-rock':
        return 'Anomalous Rock Sample'
      case 'drill-site':
        return 'Drill Site Cuttings'
      case 'ice-deposit':
        return 'Subsurface Ice Melt'
      case 'scientific':
        return 'Stratified Outcrop'
      default:
        return 'Surface Sample'
    }
  }

  private generateElements(poi: POI | null): ElementReading[] {
    // Plausible Martian regolith composition; tweak by POI type
    const base: ElementReading[] = [
      { symbol: 'Fe₂O₃', name: 'Iron Oxide', pct: 18.2, color: '#b3401a' },
      { symbol: 'SiO₂', name: 'Silicon Dioxide', pct: 43.1, color: '#c9a86a' },
      { symbol: 'MgO', name: 'Magnesium Oxide', pct: 8.4, color: '#6fae8a' },
      { symbol: 'CaO', name: 'Calcium Oxide', pct: 6.7, color: '#d8d2c0' },
      { symbol: 'Al₂O₃', name: 'Aluminum Oxide', pct: 10.3, color: '#9aa0b0' },
      { symbol: 'SO₃', name: 'Sulfur Trioxide', pct: 5.9, color: '#e0c84a' },
      { symbol: 'ClO₄⁻', name: 'Perchlorates', pct: 0.7, color: '#7ec8ff' },
      { symbol: 'H₂O', name: 'Water', pct: 3.2, color: '#4fb3ff' },
    ]
    if (poi?.type === 'ice-deposit') {
      base[7].pct = 41.5
      base[6].pct = 1.4
      base[0].pct = 11.0
    } else if (poi?.type === 'anomalous-rock') {
      base[0].pct = 27.8
      base[5].pct = 9.1
    }
    // normalize to 100
    const sum = base.reduce((a, b) => a + b.pct, 0)
    for (const e of base) e.pct = +(e.pct * (100 / sum)).toFixed(1)
    return base.sort((a, b) => b.pct - a.pct)
  }

  update(dt: number, roverTip: THREE.Vector3) {
    if (!this.active) return
    this.progress += dt / this.duration
    const p = Math.min(1, this.progress)

    if (this.active === 'drill') {
      this.drillDepth = p * 2.6
      // particle burst while drilling
      if (Math.random() < 0.6) this.cb.spawnDrillParticles(roverTip, 0.5 + Math.random())
      // reveal strata progressively
      const strata = initialStrata.map((s) => ({ ...s }))
      useMarsStore.getState().setDrill({
        progress: p * 100,
        depth: this.drillDepth,
        discoveredWater: this.drillDepth > 1.9,
      })
      if (this.drillDepth > 1.9 && !useMarsStore.getState().drill.discoveredWater) {
        useMarsStore.getState().addLog('ok', 'DRILL: Permafrost layer breached — subsurface water ice confirmed!')
      }
    } else if (this.active === 'spectro') {
      // beam effect
      this.cb.spawnSpectroBeam(roverTip)
      // progressively reveal elements
      const reveal = Math.ceil(p * this.elements.length)
      useMarsStore.getState().setSpectro({
        progress: p * 100,
        sample: this.spectroSample,
        elements: this.elements.slice(0, reveal),
      })
    } else if (this.active === 'biosignature') {
      const findings = this.generateBiosignature(p)
      useMarsStore.getState().setBiosignature({
        progress: p * 100,
        findings,
        detectedOrganics: p > 0.6 && this.poi?.type === 'ice-deposit',
      })
      if (p > 0.6 && useMarsStore.getState().biosignature.findings.length > 0) {
        const last = useMarsStore.getState().biosignature.findings[useMarsStore.getState().biosignature.findings.length - 1]
        if (!last.name.includes('detected')) {
          // already logged
        }
      }
    } else if (this.active === 'weather') {
      // record a sample
      const env = useMarsStore.getState().environment
      useMarsStore.getState().pushWeather({
        t: Date.now(),
        temp: env.temp,
        pressure: env.pressure,
        wind: env.windSpeed,
      })
    }

    if (p >= 1) {
      // finalize
      if (this.active === 'drill') {
        useMarsStore.getState().setDrill({ active: false, progress: 100 })
      } else if (this.active === 'spectro') {
        useMarsStore.getState().setSpectro({ active: false, progress: 100, elements: this.elements })
        useMarsStore.getState().addLog('ok', `SPECTRO: ${this.spectroSample} composition archived.`)
      } else if (this.active === 'biosignature') {
        const detected = useMarsStore.getState().biosignature.detectedOrganics
        useMarsStore.getState().setBiosignature({ active: false, progress: 100 })
        useMarsStore.getState().addLog(
          detected ? 'ok' : 'info',
          detected
            ? 'BIOSIG: Trace organic carbon compounds detected. Candidate micro-structure flagged.'
            : 'BIOSIG: No definitive organics. Baseline abiotic chemistry confirmed.'
        )
      } else if (this.active === 'weather') {
        useMarsStore.getState().addLog('ok', 'WEATHER: Atmospheric data recorded to telemetry.')
      }
      this.active = null
      this.progress = 0
      const cb = this.onComplete
      this.onComplete = () => {}
      cb()
    }
  }

  private generateBiosignature(p: number) {
    const all = [
      { name: 'Methane Trace (CH₄)', confidence: 62, type: 'Atmospheric' },
      { name: 'Organic Carbon (C-org)', confidence: 78, type: 'Compound' },
      { name: 'Aromatic Hydrocarbons', confidence: 54, type: 'Compound' },
      { name: 'Micro-fossil Structure', confidence: 41, type: 'Morphology' },
      { name: 'Nitrogen Species', confidence: 33, type: 'Compound' },
    ]
    const count = Math.ceil(p * all.length)
    return all.slice(0, count).map((f) => ({
      ...f,
      confidence: this.poi?.type === 'ice-deposit' ? f.confidence + 12 : f.confidence,
    }))
  }

  abort() {
    this.active = null
    this.progress = 0
  }
}
