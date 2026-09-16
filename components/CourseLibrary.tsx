'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, BookOpen, Cloud, Code2, Database, FileSpreadsheet, Search, Sigma } from 'lucide-react'
import { useMemo, useState } from 'react'
import { courseLibrary } from '@/lib/course-catalog'

type IconKey = (typeof courseLibrary)[number]['icon']

const icons: Record<IconKey, typeof Database> = {
  sql: Database,
  excel: FileSpreadsheet,
  analytics: BarChart3,
  pandas: BarChart3,
  numpy: Sigma,
  python: Code2,
  aws: Cloud,
}

const tones: Record<IconKey, { icon: string; glow: string; ring: string }> = {
  sql: { icon: 'bg-blue-50 text-blue-600', glow: 'from-blue-500/10', ring: 'group-hover:border-blue-200' },
  excel: { icon: 'bg-emerald-50 text-emerald-600', glow: 'from-emerald-500/10', ring: 'group-hover:border-emerald-200' },
  analytics: { icon: 'bg-violet-50 text-violet-600', glow: 'from-violet-500/10', ring: 'group-hover:border-violet-200' },
  pandas: { icon: 'bg-cyan-50 text-cyan-600', glow: 'from-cyan-500/10', ring: 'group-hover:border-cyan-200' },
  numpy: { icon: 'bg-indigo-50 text-indigo-600', glow: 'from-indigo-500/10', ring: 'group-hover:border-indigo-200' },
  python: { icon: 'bg-amber-50 text-amber-600', glow: 'from-amber-500/10', ring: 'group-hover:border-amber-200' },
  aws: { icon: 'bg-orange-50 text-orange-600', glow: 'from-orange-500/10', ring: 'group-hover:border-orange-200' },
}

export default function CourseLibrary() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return courseLibrary
    return courseLibrary.filter(c => `${c.title} ${c.description}`.toLowerCase().includes(q))
  }, [query])

  return <div className="space-y-8">
    <div className="luxury-surface relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="badge-brand mb-3"><BookOpen size={14} /> Web Study Library</div>
          <h2 className="max-w-3xl text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Study from clean web pages, not PDF viewers.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Choose a subject to open its converted study material. Topics stay in a focused reading layout with code blocks, quick navigation and no document chrome.</p>
        </div>
        <label className="relative block w-full shrink-0 lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input value={query} onChange={e => setQuery(e.target.value)} className="input pl-10" placeholder="Search study materials..." aria-label="Search study materials" />
        </label>
      </div>
    </div>

    {filtered.length === 0 ? <div className="card p-10 text-center text-sm text-slate-500">No study material matches “{query}”.</div> :
      <div className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {filtered.map(course => {
          const Icon = icons[course.icon]
          const tone = tones[course.icon]
          return <Link href={`/courses/materials/${course.slug}`} key={course.slug} className={`card-hover group relative aspect-square overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-sm ${tone.ring}`}>
            <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${tone.glow} to-transparent`} />
            <div className="relative">
              <div className={`grid h-16 w-16 place-items-center rounded-2xl shadow-sm ring-1 ring-black/5 ${tone.icon}`}><Icon size={28} strokeWidth={2.1} /></div>
              <div className="mt-5 flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-black leading-tight text-slate-900">{course.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{course.description}</p></div>
                <ArrowRight size={18} className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand" />
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10"><BookOpen size={14} /></span> Open web course</div>
            </div>
          </Link>
        })}
      </div>
    }
  </div>
}
