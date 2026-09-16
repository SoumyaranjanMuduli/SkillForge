import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseImportText } from '@/lib/excel-import'

export const runtime = 'nodejs'

const bodySchema = z.object({ text: z.string().trim().min(1).max(2_000_000) })

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json({ error: 'Paste content is required.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: programs } = await admin.from('programs').select('id, slug')
  const programMap = new Map((programs ?? []).flatMap((p: { id: string; slug: string }) => [[p.id.toLowerCase(), p.id], [p.slug.toLowerCase(), p.id]] as [string, string][]))
  const knownProgramIds = [...programMap.keys()]

  let result
  try {
    result = parseImportText(parsedBody.data.text, knownProgramIds)
    result.rows = result.rows.map((row) => row.ok ? { ...row, data: { ...row.data, programId: programMap.get(row.data.programId.toLowerCase()) ?? row.data.programId } } : row)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? `Could not parse pasted rows: ${e.message}` : 'Could not parse pasted rows.' }, { status: 400 })
  }

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'No rows found. Include a header row followed by one or more questions.' }, { status: 400 })
  }

  const validIds = result.rows.filter((r) => r.ok).map((r) => r.data.id)
  const existing = validIds.length
    ? await admin.from('questions').select('id').in('id', validIds)
    : { data: [] as { id: string }[] }
  const existingIds = (existing.data ?? []).map((r) => r.id)

  return NextResponse.json({
    filename: 'pasted-questions.tsv',
    totalRows: result.rows.length,
    validCount: result.validCount,
    errorCount: result.errorCount,
    duplicateIds: result.duplicateIds,
    existingIds,
    rows: result.rows,
  })
}
