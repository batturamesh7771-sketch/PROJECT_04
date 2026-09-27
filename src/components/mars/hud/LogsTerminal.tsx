'use client'

import { useEffect, useRef } from 'react'
import { useMarsStore } from '@/lib/mars/store'
import { Terminal, Trash2 } from 'lucide-react'

const LEVEL_COLOR: Record<string, string> = {
  info: 'text-amber-100/70',
  warn: 'text-rose-400',
  ok: 'text-emerald-400',
  ai: 'text-sky-300',
}
const LEVEL_TAG: Record<string, string> = {
  info: 'SYS',
  warn: 'WRN',
  ok: 'OK ',
  ai: 'AI ',
}

export function LogsTerminal() {
  const logs = useMarsStore((s) => s.logs)
  const clearLogs = useMarsStore((s) => s.clearLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  const fmtTime = (t: number) => {
    const d = new Date(t)
    return (
      d.getHours().toString().padStart(2, '0') +
      ':' +
      d.getMinutes().toString().padStart(2, '0') +
      ':' +
      d.getSeconds().toString().padStart(2, '0')
    )
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
          <Terminal className="h-3 w-3" /> AI Reasoning Engine
        </span>
        <button
          onClick={clearLogs}
          className="rounded p-1 text-amber-300/50 transition hover:bg-amber-500/10 hover:text-amber-200"
          title="Clear logs"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="custom-scroll max-h-44 flex-1 overflow-y-auto rounded-md border border-amber-500/15 bg-black/50 p-2 font-mono text-[10.5px] leading-relaxed"
      >
        {logs.length === 0 && (
          <div className="text-amber-100/30">awaiting telemetry…</div>
        )}
        {logs.map((l) => (
          <div key={l.id} className="flex gap-1.5">
            <span className="shrink-0 text-amber-300/40">{fmtTime(l.t)}</span>
            <span className={`shrink-0 ${LEVEL_COLOR[l.level]}`}>[{LEVEL_TAG[l.level]}]</span>
            <span className="text-amber-50/85">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
