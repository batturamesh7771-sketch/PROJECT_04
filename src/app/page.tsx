'use client'

import dynamic from 'next/dynamic'

const MarsSimulation = dynamic(() => import('@/components/mars/MarsSimulation'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#1a0d06] text-amber-300">
      <div className="font-mono text-sm tracking-widest">INITIALIZING MARTIAN SURFACE…</div>
    </div>
  ),
})

export default function Home() {
  return <MarsSimulation />
}
