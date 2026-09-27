'use client'

import { useMarsStore, type CameraMode } from '@/lib/mars/store'
import { Camera, Eye, Crosshair, Orbit, Wrench } from 'lucide-react'

const MODES: { id: CameraMode; label: string; icon: React.ReactNode; key: string }[] = [
  { id: 'follow', label: 'Follow', icon: <Camera className="h-3.5 w-3.5" />, key: '1' },
  { id: 'navcam', label: 'NavCam', icon: <Eye className="h-3.5 w-3.5" />, key: '2' },
  { id: 'armcam', label: 'ArmCam', icon: <Wrench className="h-3.5 w-3.5" />, key: '3' },
  { id: 'orbital', label: 'Orbital', icon: <Orbit className="h-3.5 w-3.5" />, key: '4' },
]

export function CameraToggle({ onSelect }: { onSelect: (m: CameraMode) => void }) {
  const mode = useMarsStore((s) => s.cameraMode)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Camera View</span>
      <div className="grid grid-cols-2 gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] transition ${
              mode === m.id
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                : 'border-amber-500/10 bg-black/20 text-amber-100/50 hover:bg-amber-500/10'
            }`}
          >
            {m.icon}
            <span className="flex-1 text-left">{m.label}</span>
            <kbd className="rounded bg-black/40 px-1 text-[8px] text-amber-200/50">{m.key}</kbd>
          </button>
        ))}
      </div>
    </div>
  )
}
