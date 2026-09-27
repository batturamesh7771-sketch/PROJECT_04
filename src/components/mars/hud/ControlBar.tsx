'use client'

import { useMarsStore, type ControlMode } from '@/lib/mars/store'
import { Bot, Joystick, Drill, Microscope, CloudSun, FlaskConical, Radio } from 'lucide-react'

interface Props {
  onControlMode: (m: ControlMode) => void
  onTrigger: (kind: 'drill' | 'spectro' | 'weather' | 'biosignature') => void
}

export function ControlBar({ onControlMode, onTrigger }: Props) {
  const controlMode = useMarsStore((s) => s.controlMode)

  const triggers: {
    id: 'drill' | 'spectro' | 'weather' | 'biosignature'
    label: string
    icon: React.ReactNode
    color: string
  }[] = [
    { id: 'drill', label: 'Drill', icon: <Drill className="h-3.5 w-3.5" />, color: '#ffb627' },
    { id: 'spectro', label: 'Spectro', icon: <Microscope className="h-3.5 w-3.5" />, color: '#36e06a' },
    { id: 'weather', label: 'Weather', icon: <CloudSun className="h-3.5 w-3.5" />, color: '#7ec8ff' },
    { id: 'biosignature', label: 'Biosig', icon: <FlaskConical className="h-3.5 w-3.5" />, color: '#c084fc' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Control Mode</span>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onControlMode('autonomous')}
            className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[10px] font-semibold transition ${
              controlMode === 'autonomous'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-500/10 bg-black/20 text-amber-100/50 hover:bg-amber-500/10'
            }`}
          >
            <Bot className="h-3.5 w-3.5" /> Autonomous AI
          </button>
          <button
            onClick={() => onControlMode('manual')}
            className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[10px] font-semibold transition ${
              controlMode === 'manual'
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                : 'border-amber-500/10 bg-black/20 text-amber-100/50 hover:bg-amber-500/10'
            }`}
          >
            <Joystick className="h-3.5 w-3.5" /> Manual Override
          </button>
        </div>
        {controlMode === 'manual' && (
          <div className="mt-0.5 flex items-center gap-1.5 rounded border border-amber-500/15 bg-black/20 px-2 py-1 text-[9px] text-amber-100/50">
            <Radio className="h-3 w-3 text-amber-300/70" />
            WASD / Arrow keys to drive · 1-4 cameras · M toggle mode
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
          Science Modules {controlMode === 'manual' ? '(Manual Trigger)' : '(AI Auto)'}
        </span>
        <div className="grid grid-cols-2 gap-1">
          {triggers.map((tr) => (
            <button
              key={tr.id}
              onClick={() => onTrigger(tr.id)}
              disabled={controlMode !== 'manual'}
              className="flex items-center gap-1.5 rounded-md border border-amber-500/10 bg-black/20 px-2 py-1.5 text-[10px] text-amber-100/70 transition enabled:hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span style={{ color: tr.color }}>{tr.icon}</span>
              <span className="flex-1 text-left">{tr.label}</span>
            </button>
          ))}
        </div>
        {controlMode === 'autonomous' && (
          <div className="text-[9px] text-amber-100/40">
            AI autonomously selects & executes science tasks at POIs.
          </div>
        )}
      </div>
    </div>
  )
}
