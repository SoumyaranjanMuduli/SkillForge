'use client'

import { useEffect, useRef, useState } from 'react'

// Animates a number counting up from 0 to `value` on mount / value change.
export function AnimatedNumber({ value, suffix = '', duration = 900 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now()
    const from = 0
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{display}{suffix}</>
}

// A progress bar that fills from 0 to `pct` shortly after mount.
export function ProgressBar({ pct, colorClass = 'bg-brand' }: { pct: number; colorClass?: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(Math.max(0, Math.min(100, pct))))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${colorClass} transition-[width] duration-[1200ms] ease-out`} style={{ width: `${width}%` }} />
  </div>
}

// A GitHub-style activity heatmap for the last ~10 weeks, driven by real submission dates.
export function ActivityHeatmap({ dates }: { dates: string[] }) {
  const today = new Date()
  const days: { key: string; count: number }[] = []
  for (let i = 69; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, count: dates.filter((x) => x === key).length })
  }
  const weeks: { key: string; count: number }[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  function shade(count: number) {
    if (count <= 0) return 'bg-slate-100'
    if (count === 1) return 'bg-brand/30'
    if (count === 2) return 'bg-brand/60'
    return 'bg-brand'
  }
  return <div className="flex gap-1">
    {weeks.map((week, wi) => (
      <div key={wi} className="flex flex-col gap-1">
        {week.map((d, di) => (
          <div
            key={d.key}
            title={`${d.key}: ${d.count} completed`}
            className={`h-3 w-3 rounded-[3px] ${shade(d.count)} transition-transform duration-150 hover:scale-125`}
            style={{ animation: 'fadeIn .4s ease-out both', animationDelay: `${(wi * 7 + di) * 6}ms` }}
          />
        ))}
      </div>
    ))}
  </div>
}
