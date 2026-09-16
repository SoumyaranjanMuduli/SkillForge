'use client'

import { AlertTriangle, RefreshCcw } from 'lucide-react'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[70vh] place-items-center luxury-gradient p-6">
      <div className="luxury-surface w-full max-w-lg rounded-3xl p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle size={24} /></div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">The page hit an unexpected error. Your work wasn’t intentionally discarded. Try again.</p>
        <button onClick={() => reset()} className="btn-primary mt-6"><RefreshCcw size={16} /> Try again</button>
      </div>
    </div>
  )
}
