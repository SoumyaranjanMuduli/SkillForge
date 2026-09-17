'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Sparkles } from 'lucide-react'
import { BackButton } from '@/components/ui'

const genders = [
  ['male', 'Male'],
  ['female', 'Female'],
  ['non_binary', 'Non-binary'],
  ['prefer_not_to_say', 'Prefer not to say'],
  ['other', 'Other'],
] as const

export default function AccountSetupPage() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void createClient().auth.getUser().then(({ data }) => {
      const n = String(data.user?.user_metadata?.full_name ?? '').trim()
      if (n) setName(n)
    })
    if (sessionStorage.getItem('skillforge_profile_saved') === '1') {
      sessionStorage.removeItem('skillforge_profile_saved')
      setError('Your profile was saved successfully, but you were sent back to this page anyway. This is a routing bug, not a form problem — please screenshot this message and send it for a fix, then try Continue again.')
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const payload = { fullName: name.trim(), age: Number(age), gender, birthYear: Number(birthYear) }
    if (payload.fullName.length < 2 || !payload.age || !payload.gender || !payload.birthYear) {
      setError('Please complete all profile fields.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/profile/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Could not save your profile.')
      sessionStorage.setItem('skillforge_profile_saved', '1')
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between"><BackButton fallbackHref="/login" /><div className="flex items-center gap-3 text-lg font-black text-slate-900">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-pop"><Sparkles size={18} fill="white" /></span>
          Skill<span className="text-brand">Forge</span>
        </div></div>
        <div className="card mt-8 p-7 sm:p-8">
          <div className="badge-brand">Account setup</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Tell us a little about you.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your profile is required once after the first login. Your birth date is stored as a year only.</p>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <Field label="Name" value={name} onChange={setName} placeholder="Your full name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Age" value={age} onChange={setAge} placeholder="22" type="number" min="13" max="100" />
              <label className="block"><span className="label">Gender</span><select className="input" value={gender} onChange={e => setGender(e.target.value)} required><option value="">Select gender</option>{genders.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            </div>
            <Field label="Birth year" value={birthYear} onChange={setBirthYear} placeholder="2004" type="number" min="1900" max={new Date().getFullYear()} />
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving profile…' : <>Continue to SkillForge <ArrowRight size={16} /></>}</button>
          </form>
        </div>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', min, max }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; min?: string | number; max?: string | number }) {
  return <label className="block"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} max={max} required /></label>
}
