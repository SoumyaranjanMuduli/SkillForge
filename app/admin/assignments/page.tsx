import {AppShell,PageTitle} from '@/components/AppShell'
import {createAdminClient} from '@/lib/supabase/admin'
import {requireAdmin} from '@/lib/auth'
import {AssignmentForm} from './form'
export default async function Assignments(){await requireAdmin();const db=createAdminClient() as any;const [{data:assessments},{data:users}]=await Promise.all([db.from('assessments').select('id,name').order('name'),db.from('profiles').select('id,full_name').eq('status','active').order('full_name')]);return <AppShell role="admin"><PageTitle eyebrow="Admin / Assignments" title="Assessment assignments" desc="Assign assessments to active users."/><AssignmentForm assessments={assessments??[]} users={users??[]}/></AppShell>}
