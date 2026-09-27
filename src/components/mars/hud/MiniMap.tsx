'use client'

import { useEffect, useRef } from 'react'
import { useMarsStore } from '@/lib/mars/store'

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mini = useMarsStore((s) => s.miniMap)
  const fps = useMarsStore((s) => s.fps)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    const size = 220
    cv.width = size * dpr
    cv.height = size * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const render = () => {
      raf = requestAnimationFrame(render)
      const bounds = mini.bounds || 120
      const scale = size / (bounds * 2)
      const cx = size / 2
      const cy = size / 2

      // background
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = 'rgba(10,6,4,0.55)'
      ctx.fillRect(0, 0, size, size)

      // grid rings
      ctx.strokeStyle = 'rgba(193,68,14,0.25)'
      ctx.lineWidth = 1
      for (let r = 30; r < size / 2; r += 30) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      // crosshair
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, size)
      ctx.moveTo(0, cy)
      ctx.lineTo(size, cy)
      ctx.stroke()

      // range labels
      ctx.fillStyle = 'rgba(217,140,74,0.5)'
      ctx.font = '8px monospace'
      ctx.fillText(`${bounds}m`, cx + 2, 10)

      // obstacles
      for (const o of mini.obstacles) {
        const ox = cx + o.x * scale
        const oy = cy + o.z * scale
        ctx.fillStyle =
          o.kind === 'crater'
            ? 'rgba(60,30,15,0.85)'
            : o.kind === 'steep'
            ? 'rgba(120,60,20,0.8)'
            : 'rgba(90,50,30,0.85)'
        ctx.beginPath()
        ctx.arc(ox, oy, Math.max(1.5, o.r * scale), 0, Math.PI * 2)
        ctx.fill()
      }

      // path history
      if (mini.path.length > 1) {
        ctx.strokeStyle = 'rgba(110,230,120,0.55)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let i = 0; i < mini.path.length; i++) {
          const px = cx + mini.path[i].x * scale
          const py = cy + mini.path[i].z * scale
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      // POIs
      for (const p of mini.pois) {
        const px = cx + p.x * scale
        const py = cy + p.z * scale
        const col =
          p.type === 'ice-deposit'
            ? '#7ec8ff'
            : p.type === 'anomalous-rock'
            ? '#ffcf4a'
            : p.type === 'drill-site'
            ? '#ff8a3a'
            : '#36e06a'
        ctx.fillStyle = p.analyzed ? 'rgba(120,120,120,0.7)' : col
        ctx.beginPath()
        ctx.arc(px, py, p.analyzed ? 2 : 3.2, 0, Math.PI * 2)
        ctx.fill()
        if (!p.analyzed) {
          ctx.strokeStyle = col
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(px, py, 5, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // target marker
      if (mini.target) {
        const tx = cx + mini.target.x * scale
        const ty = cy + mini.target.z * scale
        ctx.strokeStyle = '#36e06a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(tx, ty, 6, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(tx - 8, ty)
        ctx.lineTo(tx + 8, ty)
        ctx.moveTo(tx, ty - 8)
        ctx.lineTo(tx, ty + 8)
        ctx.stroke()
      }

      // LIDAR sweep
      const sweepA = mini.lidarSweep * Math.PI * 2
      const grad = ctx.createConicGradient ? ctx.createConicGradient(sweepA, cx, cy) : null
      if (grad) {
        grad.addColorStop(0, 'rgba(120,255,160,0.35)')
        grad.addColorStop(0.15, 'rgba(120,255,160,0)')
        grad.addColorStop(1, 'rgba(120,255,160,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // rover
      const rx = cx + mini.rover.x * scale
      const ry = cy + mini.rover.z * scale
      ctx.save()
      ctx.translate(rx, ry)
      ctx.rotate(-mini.rover.heading)
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#36e06a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 6)
      ctx.lineTo(-4, -4)
      ctx.lineTo(0, -2)
      ctx.lineTo(4, -4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [mini])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">LIDAR Grid</span>
        <span className="text-[10px] font-mono text-emerald-300/70">{fps} FPS</span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-amber-500/20 bg-black/30">
        <canvas ref={canvasRef} style={{ width: 220, height: 220 }} className="block" />
        <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-amber-400/10" />
      </div>
    </div>
  )
}
