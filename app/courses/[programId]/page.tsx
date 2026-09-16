import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, FileText } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser, getPrograms } from '@/lib/assessment'
import { programVisual } from '@/lib/ui-helpers'

export const dynamic = 'force-dynamic'

export default async function CoursePage({ params }: { params: Promise<{ programId: string }> }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const { programId } = await params
  const programs = await getPrograms()
  const program = programs.find(p => p.id === programId)
  if (!program) return <AppShell><div className="card p-8">Course not found.</div></AppShell>
  const db = createAdminClient() as any
  const { data: questions } = await db.from('questions').select('id,title,topic,difficulty,question_type').eq('program_id', programId).eq('status', 'published').order('created_at', { ascending: false }).limit(200)
  const { Icon, bg, text } = programVisual(program.name)
  const byDifficulty = ['easy', 'medium', 'hard'].map(d => ({ difficulty: d, rows: (questions ?? []).filter((q: any) => q.difficulty === d) }))

  return <AppShell>
    <Link href="/courses" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand"><ArrowLeft size={15} /> Back to courses</Link>
    <div className="card overflow-hidden">
      <div className="luxury-gradient p-6 sm:p-8"><div className={`grid h-14 w-14 place-items-center rounded-2xl ${bg} ${text}`}><Icon size={25} /></div><h1 className="mt-5 text-3xl font-black text-slate-900">{program.name}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{program.description}</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/practice?program=${program.id}`} className="btn-primary">Practice {program.name} <ArrowRight size={15} /></Link><Link href={`/assessments?program=${program.id}`} className="btn-secondary">Assessments</Link></div></div>
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_.8fr]">
        <section><div className="flex items-center gap-2 text-sm font-bold text-slate-900"><BookOpen size={17} className="text-brand" /> Course notes</div><div className="prose prose-slate mt-5 max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-600">{(program as any).notes || 'Course notes haven’t been published yet. Check back after the administrator adds this course content.'}</div></section>
        <aside className="card h-fit p-5"><div className="flex items-center gap-2 font-bold text-slate-900"><FileText size={17} className="text-brand" /> Question bank</div><div className="mt-4 space-y-3">{byDifficulty.map(({ difficulty, rows }) => <div key={difficulty} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="capitalize text-sm text-slate-600">{difficulty}</span><span className="font-black text-slate-900">{rows.length}</span></div>)}<div className="pt-1 text-xs text-slate-400">Only published questions appear to students.</div></div></aside>
      </div>
    </div>
  </AppShell>
}
