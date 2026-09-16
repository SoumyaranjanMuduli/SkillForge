'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Theme = 'light' | 'dark'

export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('skillforge-theme')
    const nextTheme: Theme = saved === 'dark' ? 'dark' : 'light'
    localStorage.setItem('skillforge-theme', nextTheme)
    document.documentElement.dataset.theme = nextTheme
    setTheme(nextTheme)
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function chooseTheme(next: Theme) {
    setTheme(next)
    localStorage.setItem('skillforge-theme', next)
    document.documentElement.dataset.theme = next
  }

  async function signOut() {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  return <div ref={menuRef} className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/10 transition hover:bg-brand/15 focus-visible:outline-none" aria-label="Open account menu" aria-expanded={open}>
      <UserRound size={17} />
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,.18)]" role="menu">
      <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" role="menuitem"><UserRound size={16} /> Your profile</Link>
      <div className="my-2 border-t border-line" />
      <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-slate-400">Appearance</p>
      <div className="grid grid-cols-3 gap-1 px-1 pb-2">
        <ThemeOption label="Light" value="light" icon={<Sun size={15} />} selected={theme} onSelect={chooseTheme} />
        <ThemeOption label="Dark" value="dark" icon={<Moon size={15} />} selected={theme} onSelect={chooseTheme} />
      </div>
      <div className="border-t border-line pt-2">
        <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50" role="menuitem"><LogOut size={16} /> Sign out</button>
      </div>
    </div>}
  </div>
}

function ThemeOption({ label, value, icon, selected, onSelect }: { label: string; value: Theme; icon: React.ReactNode; selected: Theme; onSelect: (theme: Theme) => void }) {
  const active = selected === value
  return <button type="button" onClick={() => onSelect(value)} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${active ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:bg-slate-50'}`} aria-pressed={active}>
    {icon}{label}{active && <Check className="absolute right-1.5 top-1.5" size={12} />}
  </button>
}
