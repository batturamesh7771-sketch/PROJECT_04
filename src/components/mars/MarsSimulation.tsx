'use client'

import { useEffect, useRef, useState } from 'react'
import { SceneManager } from '@/lib/mars/scene-manager'
import { useMarsStore, type CameraMode, type ControlMode } from '@/lib/mars/store'
import { TelemetryPanel } from './hud/TelemetryPanel'
import { MiniMap } from './hud/MiniMap'
import { LogsTerminal } from './hud/LogsTerminal'
import { ScienceHub } from './hud/ScienceHub'
import { CameraToggle } from './hud/CameraToggle'
import { ControlBar } from './hud/ControlBar'
import { Satellite, Radar, Rocket } from 'lucide-react'

export default function MarsSimulation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ready = useMarsStore((s) => s.ready)
  const power = useMarsStore((s) => s.telemetry.power)
  const aiStatus = useMarsStore((s) => s.telemetry.aiStatus)
  const solarTime = useMarsStore((s) => s.environment.solarTime)

  useEffect(() => {
    if (!containerRef.current) return
    let scene: SceneManager | null = null
    try {
      scene = new SceneManager(containerRef.current)
      sceneRef.current = scene
      scene.start()
    } catch (e) {
      console.error(e)
      // Defer to avoid cascading renders during effect; run on next tick.
      queueMicrotask(() =>
        setError(e instanceof Error ? e.message : 'Failed to init 3D engine')
      )
    }
    return () => {
      if (scene) scene.dispose()
      sceneRef.current = null
    }
  }, [])

  const handleCamera = (m: CameraMode) => {
    sceneRef.current?.setCameraMode(m)
  }
  const handleControl = (m: ControlMode) => {
    sceneRef.current?.setControlMode(m)
  }
  const handleTrigger = (kind: 'drill' | 'spectro' | 'weather' | 'biosignature') => {
    sceneRef.current?.triggerScience({ kind })
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1a0d06] text-amber-50">
      {/* 3D canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {!ready && !error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#1a0d06]">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
            <Rocket className="absolute inset-0 m-auto h-7 w-7 text-amber-400" />
          </div>
          <div className="font-mono text-sm tracking-widest text-amber-300">
            INITIALIZING MARTIAN SURFACE…
          </div>
          <div className="text-[10px] text-amber-100/40">Procedural terrain · Rover systems · Autonomous AI</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1a0d06] p-8 text-center">
          <div>
            <div className="mb-2 font-mono text-rose-400">WEBGL ENGINE ERROR</div>
            <div className="text-xs text-amber-100/60">{error}</div>
          </div>
        </div>
      )}

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
        {/* Top bar */}
        <header className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-400/30 bg-amber-500/10">
              <Satellite className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-amber-100">
                ARES-IV <span className="text-amber-400/70">MARS SURFACE SIMULATION</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-amber-300/50">
                Autonomous Rover · Jezero Crater Sector 7
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge label="SOL TIME" value={`${solarTime.toFixed(1)}h`} />
            <Badge label="POWER" value={`${power.toFixed(0)}%`} accent={power < 20 ? 'red' : power < 50 ? 'amber' : 'green'} />
            <Badge label="AI" value={aiStatus} />
          </div>
        </header>

        {/* Middle area: left + right side panels */}
        <div className="flex flex-1 gap-3 overflow-hidden px-3 pb-2">
          {/* Left column */}
          <div className="pointer-events-auto flex w-60 flex-col gap-3 overflow-y-auto custom-scroll pb-1">
            <GlassPanel>
              <TelemetryPanel />
            </GlassPanel>
            <GlassPanel>
              <CameraToggle onSelect={handleCamera} />
            </GlassPanel>
            <GlassPanel>
              <ControlBar onControlMode={handleControl} onTrigger={handleTrigger} />
            </GlassPanel>
          </div>

          {/* center spacer (canvas shows through) */}
          <div className="flex-1" />

          {/* Right column */}
          <div className="pointer-events-auto flex w-64 flex-col gap-3 overflow-y-auto custom-scroll pb-1">
            <GlassPanel>
              <MiniMap />
            </GlassPanel>
            <GlassPanel>
              <ScienceHub />
            </GlassPanel>
          </div>
        </div>

        {/* Bottom: logs terminal spanning width */}
        <div className="pointer-events-auto px-3 pb-2">
          <GlassPanel>
            <LogsTerminal />
          </GlassPanel>
        </div>

        {/* Sticky footer status bar */}
        <footer className="pointer-events-auto mt-auto border-t border-amber-500/15 bg-black/40 px-4 py-1.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[9px] text-amber-100/50">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Radar className="h-3 w-3 text-emerald-400/70" /> LINK: NOMINAL
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> DSN: 70m GOLDSTONE
              </span>
              <span>RTG · 110W</span>
            </div>
            <div className="hidden sm:block">
              Three.js WebGL · Procedural Terrain · GOAP Autonomous AI · Rocker-Bogie Mobility
            </div>
            <div className="font-mono">ARES-IV · MISSION CONTROL v2.4</div>
          </div>
        </footer>
      </div>
    </div>
  )
}

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-black/50 p-3 shadow-lg backdrop-blur-md">
      {children}
    </div>
  )
}

function Badge({
  label,
  value,
  accent = 'amber',
}: {
  label: string
  value: string
  accent?: 'amber' | 'green' | 'red'
}) {
  const color =
    accent === 'green'
      ? 'border-emerald-400/30 text-emerald-300'
      : accent === 'red'
      ? 'border-rose-400/30 text-rose-300'
      : 'border-amber-400/30 text-amber-200'
  return (
    <div className={`rounded-md border bg-black/40 px-2 py-1 backdrop-blur-md ${color}`}>
      <div className="text-[8px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-mono text-[11px] font-semibold">{value}</div>
    </div>
  )
}
