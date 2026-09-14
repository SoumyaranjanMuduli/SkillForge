import Link from 'next/link'
import { ArrowRight, BarChart3, CheckCircle2, Code2, Database, FileSpreadsheet, Layers, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'

const programs = [
  ['SQL', 'Query writing, joins, subqueries, CTEs, windows and data quality.', Database, 'bg-blue-50 text-blue-600'],
  ['Python', 'Core Python, NumPy, Pandas and data analysis tasks.', Code2, 'bg-amber-50 text-amber-600'],
  ['Excel', 'Formulas, lookups, cleaning, dates, statistics and analytics workflows.', FileSpreadsheet, 'bg-emerald-50 text-emerald-600'],
  ['Data Engineering', 'ETL, SQL transformations, data quality, modeling and pipelines.', BarChart3, 'bg-purple-50 text-purple-600']
] as const

const stats = [
  ['Multiple Programs', 'All in one place', Layers],
  ['Real Assessments', 'Timed & auto-graded', ListChecks],
  ['Detailed Analytics', 'Track your progress', BarChart3],
  ['Industry Relevant', 'Practice like real work', ShieldCheck]
] as const

export default function Home() {
  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">SF</span>
            Skill<span className="text-brand">Forge</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <Link href="/" className="text-slate-900">Home</Link>
            <Link href="/programs" className="hover:text-slate-900">Programs</Link>
            <Link href="/programs" className="hover:text-slate-900">About</Link>
            <Link href="/programs" className="hover:text-slate-900">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">Login</Link>
            <Link href="/register" className="btn-primary">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div className="animate-fade-in-up">
          <div className="badge-brand mb-5 inline-flex gap-1.5"><Sparkles size={13} /> Practice • Assess • Grow</div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.05] tracking-tight text-slate-900 md:text-6xl">
            Master In-Demand <span className="text-brand">Skills</span>, One Platform
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">
            Practice, take assessments, and track your progress in SQL, Python, Excel, Data Engineering and more.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Get Started <ArrowRight size={18} /></Link>
            <Link href="/programs" className="btn-secondary">View Programs</Link>
          </div>
          <div className="stagger mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map(([title, desc, Icon]) => (
              <div key={title}>
                <Icon size={20} className="text-brand" />
                <div className="mt-2 text-sm font-bold text-slate-800">{title}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-scale-in">
          <div className="absolute -right-4 -top-6 grid gap-3">
            <FloatingBadge label="SQL" className="bg-blue-50 text-blue-600" delay="0s" />
            <FloatingBadge label="Python" className="bg-amber-50 text-amber-600 ml-6" delay=".6s" />
          </div>
          <div className="absolute -left-4 bottom-10 grid gap-3">
            <FloatingBadge label="Excel" className="bg-emerald-50 text-emerald-600" delay=".3s" />
          </div>
          <div className="card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Assessment overview</div>
                <div className="text-xs text-slate-400">SQL Level 1</div>
              </div>
              <span className="badge">42m 18s</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Score" value="82%" />
              <Metric label="Correct" value="24" />
              <Metric label="Wrong" value="4" />
            </div>
            <div className="mt-5 space-y-2.5">
              {[['Q1', '00:43', 'correct'], ['Q2', '01:32', 'correct'], ['Q3', '05:48', 'wrong'], ['Q4', '00:57', 'correct'], ['Q5', '08:14', 'wrong']].map(([q, t, state]) => (
                <div key={q} className="flex items-center justify-between rounded-xl border border-line bg-slate-50/60 px-4 py-2.5">
                  <span className="text-sm font-medium text-slate-700">{q}</span>
                  <span className="text-xs text-slate-400">{t}</span>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${state === 'correct' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {state === 'correct' ? <CheckCircle2 size={14} /> : null} {state === 'correct' ? 'Correct' : 'Wrong'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Programs</div>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Built for job-ready practice</h2>
        </div>
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {programs.map(([name, desc, Icon, cls]) => (
            <div key={name} className="card card-hover p-5">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${cls}`}><Icon size={22} /></div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-3">
          <Feature icon={ShieldCheck} title="Every second tracked" text="Server-backed timestamps for attempts and per-question duration." />
          <Feature icon={CheckCircle2} title="Results stay locked" text="Users see their detailed result only after an admin releases it." />
          <Feature icon={Database} title="One question model" text="Add SQL, Python, Excel, MCQ and data engineering tasks without changing the platform." />
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-400">SkillForge assessment platform</footer>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-slate-50/60 p-4 text-center"><div className="text-2xl font-black text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>
}

function Feature({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10"><Icon size={20} className="text-brand" /></div><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>
}

function FloatingBadge({ label, className, delay }: { label: string; className: string; delay: string }) {
  return <div className={`animate-float rounded-xl px-3 py-2 text-xs font-bold shadow-card ${className}`} style={{ animationDelay: delay }}>{label}</div>
}
