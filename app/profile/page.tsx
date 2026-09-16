'use client'

import { useEffect, useState } from 'react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { Save, UserRound } from 'lucide-react'

const genders = [['male','Male'],['female','Female'],['non_binary','Non-binary'],['prefer_not_to_say','Prefer not to say'],['other','Other']] as const

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/profile').then(async r => r.ok ? r.json() : null).then(p => { if (!p) return; setName(p.fullName ?? ''); setAge(p.age ? String(p.age) : ''); setGender(p.gender ?? ''); setBirthYear(p.birthYear ? String(p.birthYear) : ''); setEmail(p.email ?? '') })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(''); setBusy(true)
    try {
      const res = await fetch('/api/profile', { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ fullName:name.trim(), age:Number(age), gender, birthYear:Number(birthYear) }) })
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error ?? 'Could not save profile')
      setMsg('Profile saved.')
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Could not save profile') } finally { setBusy(false) }
  }

  return <AppShell><PageTitle eyebrow="Account" title="Your profile" desc="Manage the information used on your SkillForge account." /><div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
    <div className="card p-6"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand/10 text-brand"><UserRound size={30}/></div><h2 className="mt-4 text-center text-xl font-black text-slate-900">{name || 'Your profile'}</h2><p className="mt-1 text-center text-sm text-slate-400">{email}</p></div>
    <form onSubmit={save} className="card p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" value={name} onChange={setName}/><Field label="Age" value={age} onChange={setAge} type="number" min="13" max="100"/><label><span className="label">Gender</span><select className="input" value={gender} onChange={e=>setGender(e.target.value)} required><option value="">Select gender</option>{genders.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><Field label="Birth year" value={birthYear} onChange={setBirthYear} type="number" min="1900" max={new Date().getFullYear()}/></div><div className="mt-5 flex items-center gap-3"><button className="btn-primary" disabled={busy}><Save size={15}/>{busy?'Saving…':'Save changes'}</button>{msg&&<span className="text-sm text-slate-500">{msg}</span>}</div></form>
  </div></AppShell>
}

function Field({label,value,onChange,type='text',min,max}:{label:string;value:string;onChange:(v:string)=>void;type?:string;min?:string|number;max?:string|number}){return <label><span className="label">{label}</span><input className="input" type={type} value={value} onChange={e=>onChange(e.target.value)} min={min} max={max} required /></label>}
