import Link from 'next/link'
import { CheckCheck, Bell, FileText, Megaphone, Trophy, UserRound } from 'lucide-react'
import { AppShell, PageTitle } from '@/components/AppShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/assessment'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/notifications-store'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await getServerUser()
  if (!user) return null
  const userId = user.id
  const db = createAdminClient() as any
  const { data } = await db.from('notifications').select('id,title,message,type,href,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
  const items = data ?? []

  async function readAll() {
    'use server'
    await markAllNotificationsRead(userId)
  }

  return <AppShell>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <PageTitle eyebrow="Student" title="Notifications" desc="Assessment updates, released results, administrator messages and account activity." />
      {items.some((n: any) => !n.read_at) && <form action={readAll}><button className="btn-secondary"><CheckCheck size={15} /> Mark all read</button></form>}
    </div>
    {items.length === 0 && <div className="card p-10 text-center"><Bell className="mx-auto text-slate-300" /><p className="mt-3 text-sm text-slate-500">You’re all caught up. New assessment and result updates will appear here.</p></div>}
    <div className="space-y-3">
      {items.map((n: any) => <NotificationRow key={n.id} item={n} userId={userId} />)}
    </div>
  </AppShell>
}

async function NotificationRow({ item, userId }: { item: any; userId: string }) {
  async function read() {
    'use server'
    await markNotificationRead(item.id, userId)
  }
  const Icon = item.type === 'result' ? Trophy : item.type === 'assessment' ? FileText : item.type === 'admin' ? Megaphone : UserRound
  return <div className={`card flex gap-4 p-5 ${item.read_at ? 'opacity-75' : 'ring-1 ring-brand/10'}`}>
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon size={19} /></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">{item.title}</h2><span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</span></div>
      <p className="mt-1 text-sm leading-6 text-slate-500">{item.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {item.href && <Link href={item.href} className="text-xs font-semibold text-brand hover:underline">Open notification</Link>}
        {!item.read_at && <form action={read}><button className="text-xs font-semibold text-slate-500 hover:text-brand">Mark as read</button></form>}
      </div>
    </div>
  </div>
}
