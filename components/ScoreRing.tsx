'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'

export function ScoreRing({ pct }: { pct: number }) {
  const [dash, setDash] = useState(0)
  const r = 42
  const c = 2 * Math.PI * r
  useEffect(() => {
    const id = requestAnimationFrame(() => setDash((pct / 100) * c))
    return () => cancelAnimationFrame(id)
  }, [pct, c])
  const color = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#e11d48'
  return <div className="relative grid h-28 w-28 place-items-center">
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - dash} style={{ transition: 'stroke-dashoffset 1.1s ease-out' }} />
    </svg>
    <div className="absolute flex flex-col items-center">
      <Trophy size={18} style={{ color }} />
      <span className="mt-0.5 text-lg font-black text-slate-900">{pct}%</span>
    </div>
  </div>
}
