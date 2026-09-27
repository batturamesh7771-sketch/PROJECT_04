'use client'

import { useMarsStore } from '@/lib/mars/store'
import { Battery, Cpu, Thermometer, HardDrive, Gauge, Activity, Mountain, Compass } from 'lucide-react'

function Bar({
  value,
  max,
  color,
  label,
  icon,
  unit,
}: {
  value: number
  max: number
  color: string
  label: string
  icon: React.ReactNode
  unit: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 text-amber-100/70">
          <span className="text-amber-300/80">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-amber-50">
          {value.toFixed(value < 10 ? 1 : 0)}
          <span className="ml-0.5 text-amber-300/50">{unit}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  )
}

const AI_LABELS: Record<string, string> = {
  IDLE: 'STANDBY',
  SURVEY: 'SURVEYING',
  PATHFIND: 'PATH PLANNING',
  NAVIGATE: 'NAVIGATING',
  DRILL: 'DRILLING',
  SPECTRO: 'SPECTRO ANALYSIS',
  WEATHER: 'WEATHER SCAN',
  BIOSIGNATURE: 'BIOSIGNATURE SCAN',
  LOW_POWER: 'LOW POWER MODE',
  HAZARD: 'HAZARD AVOIDANCE',
}

export function TelemetryPanel() {
  const t = useMarsStore((s) => s.telemetry)
  const powerColor =
    t.power > 50 ? '#36e06a' : t.power > 20 ? '#ffb627' : '#ff3b3b'
  const ledGlow =
    t.led === 'green'
      ? '0 0 12px #36e06a, 0 0 4px #36e06a'
      : t.led === 'amber'
      ? '0 0 12px #ffb627, 0 0 4px #ffb627'
      : '0 0 12px #ff3b3b, 0 0 4px #ff3b3b'
  const ledColor = t.led === 'green' ? '#36e06a' : t.led === 'amber' ? '#ffb627' : '#ff3b3b'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
          System Telemetry
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: ledColor, boxShadow: ledGlow }}
          />
          <span className="text-[10px] font-mono text-amber-100/60">
            {t.led.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-amber-500/15 bg-black/30 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] text-amber-100/70">
          <Activity className="h-3 w-3 text-emerald-300/80" /> AI STATE
        </span>
        <span className="font-mono text-[11px] font-semibold text-emerald-300">
          {AI_LABELS[t.aiStatus] || t.aiStatus}
        </span>
      </div>

      <Bar
        label="POWER"
        value={t.power}
        max={100}
        unit="%"
        color={powerColor}
        icon={<Battery className="h-3 w-3" />}
      />
      <Bar
        label="MOTOR RPM"
        value={t.motorRPM}
        max={600}
        unit="rpm"
        color="#ffb627"
        icon={<Gauge className="h-3 w-3" />}
      />
      <Bar
        label="INTERNAL TEMP"
        value={t.internalTemp + 80}
        max={100}
        unit="°C"
        color="#4fb3ff"
        icon={<Thermometer className="h-3 w-3" />}
      />
      <Bar
        label="STORAGE"
        value={t.storageUsed}
        max={t.storageTotal}
        unit="GB"
        color="#36e06a"
        icon={<HardDrive className="h-3 w-3" />}
      />

      <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
        <div className="rounded-md border border-amber-500/15 bg-black/20 px-2 py-1.5">
          <div className="flex items-center gap-1 text-amber-100/50">
            <Compass className="h-3 w-3" /> HEADING
          </div>
          <div className="font-mono text-amber-50">
            {(((t.heading % 360) + 360) % 360).toFixed(0)}°
          </div>
        </div>
        <div className="rounded-md border border-amber-500/15 bg-black/20 px-2 py-1.5">
          <div className="flex items-center gap-1 text-amber-100/50">
            <Mountain className="h-3 w-3" /> SLOPE
          </div>
          <div className="font-mono text-amber-50">{t.slope.toFixed(1)}°</div>
        </div>
        <div className="rounded-md border border-amber-500/15 bg-black/20 px-2 py-1.5">
          <div className="flex items-center gap-1 text-amber-100/50">
            <Cpu className="h-3 w-3" /> SPEED
          </div>
          <div className="font-mono text-amber-50">{t.speed.toFixed(2)} m/s</div>
        </div>
        <div className="rounded-md border border-amber-500/15 bg-black/20 px-2 py-1.5">
          <div className="flex items-center gap-1 text-amber-100/50">
            <Compass className="h-3 w-3" /> POS
          </div>
          <div className="font-mono text-amber-50">
            {t.posX.toFixed(0)},{t.posZ.toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  )
}
