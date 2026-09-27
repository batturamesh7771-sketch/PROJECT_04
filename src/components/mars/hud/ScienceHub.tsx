'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarsStore } from '@/lib/mars/store'
import { Microscope, Waves, CloudSun, FlaskConical, Drill } from 'lucide-react'

type Tab = 'drill' | 'spectro' | 'weather' | 'biosig'

export function ScienceHub() {
  const [tab, setTab] = useState<Tab>('spectro')
  const drill = useMarsStore((s) => s.drill)
  const spectro = useMarsStore((s) => s.spectro)
  const weather = useMarsStore((s) => s.weatherHistory)
  const env = useMarsStore((s) => s.environment)
  const bio = useMarsStore((s) => s.biosignature)

  const tabs: { id: Tab; label: string; icon: React.ReactNode; active: boolean }[] = [
    { id: 'spectro', label: 'Spectro', icon: <Microscope className="h-3 w-3" />, active: spectro.active },
    { id: 'drill', label: 'Core', icon: <Drill className="h-3 w-3" />, active: drill.active },
    { id: 'weather', label: 'Weather', icon: <CloudSun className="h-3 w-3" />, active: false },
    { id: 'biosig', label: 'Biosig', icon: <FlaskConical className="h-3 w-3" />, active: bio.active },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
          Scientific Data Hub
        </span>
        <span className="text-[10px] font-mono text-amber-100/50">{env.solarTime.toFixed(1)}h SOL</span>
      </div>
      <div className="flex gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`relative flex flex-1 items-center justify-center gap-1 rounded-md border px-1 py-1 text-[10px] transition ${
              tab === tb.id
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                : 'border-amber-500/10 bg-black/20 text-amber-100/50 hover:bg-amber-500/10'
            }`}
          >
            {tb.icon}
            {tb.label}
            {tb.active && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-amber-500/15 bg-black/30 p-2.5">
        {tab === 'spectro' && <SpectroView spectro={spectro} />}
        {tab === 'drill' && <DrillView drill={drill} />}
        {tab === 'weather' && <WeatherView weather={weather} env={env} />}
        {tab === 'biosig' && <BiosigView bio={bio} />}
      </div>
    </div>
  )
}

function SpectroView({ spectro }: { spectro: ReturnType<typeof useMarsStore.getState>['spectro'] }) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = (cv.width = 280)
    const H = (cv.height = 90)
    ctx.clearRect(0, 0, W, H)
    // grid
    ctx.strokeStyle = 'rgba(193,68,14,0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    // bars
    const els = spectro.elements
    if (els.length === 0) {
      ctx.fillStyle = 'rgba(255,193,74,0.4)'
      ctx.font = '10px monospace'
      ctx.fillText(spectro.active ? 'Acquiring spectrum…' : 'Idle — awaiting sample', 8, 45)
      return
    }
    const bw = W / els.length
    els.forEach((e, i) => {
      const h = (e.pct / 50) * H
      const x = i * bw + 2
      ctx.fillStyle = e.color
      ctx.fillRect(x, H - h, bw - 4, h)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '8px monospace'
      ctx.fillText(e.symbol, x + 1, H - 2)
    })
  }, [spectro])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-amber-100/60">XRF / Raman Spectrum</span>
        <span className="font-mono text-amber-50">{spectro.sample}</span>
      </div>
      <canvas ref={cvRef} style={{ width: '100%', height: 90 }} className="rounded bg-black/40" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        {spectro.elements.map((e) => (
          <div key={e.symbol} className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-amber-100/70">
              <span className="h-2 w-2 rounded-sm" style={{ background: e.color }} />
              {e.symbol}
            </span>
            <span className="font-mono text-amber-50">{e.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      {spectro.active && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${spectro.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

function DrillView({ drill }: { drill: ReturnType<typeof useMarsStore.getState>['drill'] }) {
  const total = drill.maxDepth
  return (
    <div className="flex gap-3">
      {/* Strata column */}
      <div className="flex w-20 flex-col gap-0.5">
        <div className="relative h-44 overflow-hidden rounded border border-amber-500/20 bg-black/40">
          {drill.strata.map((s, i) => {
            const top = (i === 0 ? 0 : drill.strata[i - 1].depth / total) * 100
            const height = ((s.depth - (i === 0 ? 0 : drill.strata[i - 1].depth)) / total) * 100
            return (
              <div
                key={s.name}
                className="absolute left-0 right-0 flex items-center justify-center text-[8px] font-semibold text-black/70"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  background: `linear-gradient(180deg, ${s.color}, ${s.color}cc)`,
                }}
              >
                {s.name}
              </div>
            )
          })}
          {/* drill bit indicator */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-yellow-300"
            style={{
              top: `${(drill.depth / total) * 100}%`,
              boxShadow: '0 0 6px #ffe066',
            }}
          />
        </div>
        <div className="text-center text-[10px] font-mono text-amber-50">
          {drill.depth.toFixed(2)}m / {total}m
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="text-[10px] text-amber-100/60">Subsurface Strata Log</div>
        {drill.strata.map((s, i) => {
          const reached = drill.depth >= s.depth
          return (
            <div
              key={s.name}
              className={`rounded border px-1.5 py-1 text-[9px] transition ${
                reached
                  ? 'border-emerald-400/30 bg-emerald-500/5'
                  : 'border-amber-500/10 bg-black/20 opacity-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                <span className="font-semibold text-amber-50">{s.name}</span>
                <span className="ml-auto font-mono text-amber-100/50">{s.depth}m</span>
              </div>
              <div className="text-amber-100/40">{s.desc}</div>
            </div>
          )
        })}
        {drill.discoveredWater && (
          <div className="mt-1 flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-500/10 px-1.5 py-1 text-[9px] text-sky-200">
            <Waves className="h-3 w-3" /> Subsurface water ice confirmed!
          </div>
        )}
        {drill.active && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${drill.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

function WeatherView({
  weather,
  env,
}: {
  weather: ReturnType<typeof useMarsStore.getState>['weatherHistory']
  env: ReturnType<typeof useMarsStore.getState>['environment']
}) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const W = (cv.width = 280)
    const H = (cv.height = 80)
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(193,68,14,0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = (H / 3) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    if (weather.length < 2) {
      ctx.fillStyle = 'rgba(255,193,74,0.4)'
      ctx.font = '10px monospace'
      ctx.fillText('Collecting samples…', 8, 40)
      return
    }
    // temp line
    const temps = weather.map((w) => w.temp)
    const tmin = Math.min(...temps) - 2
    const tmax = Math.max(...temps) + 2
    const mapY = (v: number) => H - ((v - tmin) / (tmax - tmin)) * H
    ctx.strokeStyle = '#ff8a3a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    weather.forEach((w, i) => {
      const x = (i / (weather.length - 1)) * W
      const y = mapY(w.temp)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    // wind line
    const winds = weather.map((w) => w.wind)
    const wmax = Math.max(...winds) + 2
    const mapWY = (v: number) => H - (v / wmax) * H
    ctx.strokeStyle = '#7ec8ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    weather.forEach((w, i) => {
      const x = (i / (weather.length - 1)) * W
      const y = mapWY(w.wind)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [weather])

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <Metric label="TEMP" value={`${env.temp.toFixed(1)}°C`} color="#ff8a3a" />
        <Metric label="PRESSURE" value={`${env.pressure.toFixed(0)} Pa`} color="#36e06a" />
        <Metric label="WIND" value={`${env.windSpeed.toFixed(1)} m/s`} color="#7ec8ff" />
        <Metric label="WIND DIR" value={`${env.windDir.toFixed(0)}°`} color="#7ec8ff" />
        <Metric label="UV INDEX" value={env.uvIndex.toFixed(1)} color="#ffb627" />
        <Metric label="DUST" value={`${(env.dustOpacity * 100).toFixed(0)}%`} color="#d99a5a" />
      </div>
      <canvas ref={cvRef} style={{ width: '100%', height: 80 }} className="rounded bg-black/40" />
      <div className="flex justify-between text-[9px]">
        <span className="flex items-center gap-1 text-amber-100/60">
          <span className="h-0.5 w-3 bg-[#ff8a3a]" /> Temp °C
        </span>
        <span className="flex items-center gap-1 text-amber-100/60">
          <span className="h-0.5 w-3 bg-[#7ec8ff]" /> Wind m/s
        </span>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-amber-500/15 bg-black/20 px-2 py-1">
      <div className="text-[9px] text-amber-100/50">{label}</div>
      <div className="font-mono text-[11px]" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function BiosigView({ bio }: { bio: ReturnType<typeof useMarsStore.getState>['biosignature'] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-amber-100/60">GC-MS Organic Compound Search</span>
        <span
          className={`font-mono ${
            bio.detectedOrganics ? 'text-emerald-400' : 'text-amber-100/50'
          }`}
        >
          {bio.detectedOrganics ? 'ORGANICS DETECTED' : 'NO ORGANICS'}
        </span>
      </div>
      {bio.findings.length === 0 && !bio.active && (
        <div className="py-4 text-center text-[10px] text-amber-100/30">
          Awaiting biosignature analysis…
        </div>
      )}
      <div className="flex flex-col gap-1">
        {bio.findings.map((f, i) => (
          <div key={i} className="rounded border border-amber-500/15 bg-black/20 px-2 py-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-amber-50">{f.name}</span>
              <span
                className="font-mono"
                style={{ color: f.confidence > 60 ? '#36e06a' : '#ffb627' }}
              >
                {f.confidence}%
              </span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full transition-all"
                style={{
                  width: `${f.confidence}%`,
                  background: f.confidence > 60 ? '#36e06a' : '#ffb627',
                }}
              />
            </div>
            <div className="text-[9px] text-amber-100/40">{f.type} signature</div>
          </div>
        ))}
      </div>
      {bio.active && (
        <div className="h-1 overflow-hidden rounded-full bg-black/40">
          <div className="h-full bg-sky-400 transition-all" style={{ width: `${bio.progress}%` }} />
        </div>
      )}
    </div>
  )
}
