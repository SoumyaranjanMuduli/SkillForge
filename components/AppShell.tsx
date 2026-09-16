'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Bell, BookOpen, ClipboardList, Code2, FileQuestion, LayoutDashboard, Layers as LayersIcon,
  LogOut, PieChart, Search, Settings, Shield, Trophy, Users, Menu, X, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ThemeMenu } from '@/components/ThemeMenu'
import { BackButton } from '@/components/ui'

const USER_NAV = [
  ['/dashboard', 'Home', LayoutDashboard],
  ['/courses', 'Courses', BookOpen],
  ['/practice', 'Practice', Code2],
  ['/assessments', 'Assessments', ClipboardList],
  ['/results', 'Results', BarChart3],
] as const

const ADMIN_NAV = [
  ['/admin/dashboard', 'Dashboard', LayoutDashboard],
  ['/admin/questions', 'Question Bank', FileQuestion],
  ['/admin/questions/import', 'Bulk Import', FileQuestion],
  ['/admin/assessments', 'Assessments', ClipboardList],
  ['/admin/assignments', 'Assignments', ClipboardList],
  ['/admin/reviews', 'Review Queue', Trophy],
  ['/admin/attempts', 'Results', Trophy],
  ['/admin/users', 'Users', Users],
  ['/admin/programs', 'Programs', LayersIcon],
  ['/admin/topics', 'Topics', Settings],
  ['/admin/reports', 'Analytics', PieChart],
  ['/admin/audit-logs', 'Audit Log', Shield],
] as const

export function AppShell({ children, role = 'user' }: { children: React.ReactNode; role?: 'user' | 'admin' }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const nav = role === 'admin' ? ADMIN_NAV : USER_NAV

  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  const navLinks = nav.map(([href, label, Icon]) => {
    const active = pathname === href || (href !== '/dashboard' && href !== '/admin/dashboard' && pathname?.startsWith(href))
    return (
      <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link relative ${active ? 'nav-link-active' : ''}`}>
        {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />}
        <Icon size={18} className={active ? 'text-brand' : 'text-slate-400'} />
        {label}
      </Link>
    )
  })

  return <div className="min-h-screen bg-surface lg:flex">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white/90 px-4 py-5 backdrop-blur lg:flex">
      <Logo href={role === 'admin' ? '/admin/dashboard' : '/dashboard'} />
      <div className="mt-8 flex-1 space-y-1">{navLinks}</div>
      <button onClick={() => void signOut()} className="nav-link text-slate-400 hover:text-rose-500"><LogOut size={18} /> Sign out</button>
    </aside>

    {mobileOpen && (
      <div className="fixed inset-0 z-50 lg:hidden">
        <button aria-label="Close menu" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
        <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-white/10 bg-white px-4 py-5 shadow-2xl">
          <div className="flex items-center justify-between px-2"><Logo href={role === 'admin' ? '/admin/dashboard' : '/dashboard'} /><button className="rounded-xl p-2 text-slate-400 hover:bg-slate-50" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
          <div className="mt-8 flex-1 space-y-1">{navLinks}</div>
          <button onClick={() => void signOut()} className="nav-link text-slate-400 hover:text-rose-500"><LogOut size={18} /> Sign out</button>
        </aside>
      </div>
    )}

    <div className="min-w-0 flex-1 pb-20 lg:pb-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/80 bg-white/90 px-4 py-3.5 backdrop-blur-xl sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button className="rounded-xl border border-line bg-white p-2 text-slate-600 shadow-sm lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <BackButton fallbackHref={role === 'admin' ? '/admin/dashboard' : '/dashboard'} />
          <div className="hidden text-sm font-medium text-slate-400 lg:block">{role === 'admin' ? 'Administrator workspace' : 'Learning workspace'}</div>
          <form className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2 md:min-w-72" onSubmit={e => { e.preventDefault(); const value = globalSearch.trim(); if (!value) return; router.push(role === 'admin' ? '/admin/questions' : `/practice?search=${encodeURIComponent(value)}`) }}>
            <Search size={15} className="shrink-0 text-slate-400" />
            <input aria-label="Search" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" placeholder={role === 'admin' ? 'Search questions, users, courses…' : 'Search courses, tests, lessons…'} />
          </form>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/notifications" className="relative rounded-full p-2.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600" aria-label="Notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse-ring rounded-full bg-rose-500" /></Link>
          <ThemeMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 lg:px-8">{children}</main>

      {role === 'user' && <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-white/95 p-1.5 shadow-[0_18px_60px_rgba(15,23,42,.16)] backdrop-blur-lg lg:hidden" aria-label="Primary navigation">
        <div className="grid grid-cols-5 gap-1">{USER_NAV.map(([href, label, Icon]) => {
          const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
          return <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? 'bg-brand/10 text-brand' : 'text-slate-400'}`}><Icon size={17} />{label}</Link>
        })}</div>
      </nav>}
    </div>
  </div>
}

function Logo({ href }: { href: string }) {
  return <Link href={href} className="flex items-center gap-2 px-2 text-lg font-black tracking-tight text-slate-900"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white shadow-pop"><Sparkles size={16} fill="white" strokeWidth={1.5} /></span>Skill<span className="text-brand">Forge</span></Link>
}

export function PageTitle({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return <div className="mb-8 animate-fade-in-up"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-brand">{eyebrow ?? 'Workspace'} <BarChart3 size={13} /></div><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{title}</h1>{desc && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{desc}</p>}</div>
}
