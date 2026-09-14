import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseImportFile } from '@/lib/excel-import'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'File is empty.' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'File exceeds the 10MB limit.' }, { status: 400 })
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type "${ext}". Use .xlsx, .xls, or .csv.` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: programs } = await admin.from('programs').select('id, slug')
  const programMap = new Map((programs ?? []).flatMap((p: { id: string; slug: string }) => [[p.id.toLowerCase(), p.id], [p.slug.toLowerCase(), p.id]] as [string, string][]))
  const knownProgramIds = [...programMap.keys()]

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 })
  }

  let result
  try {
    result = parseImportFile(buffer, knownProgramIds)
    result.rows = result.rows.map((row) => row.ok ? { ...row, data: { ...row.data, programId: programMap.get(row.data.programId.toLowerCase()) ?? row.data.programId } } : row)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? `Could not parse file: ${e.message}` : 'Could not parse file.' }, { status: 400 })
  }

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'No rows found. Check that the first row contains column headers matching the import template.' }, { status: 400 })
  }

  const ids = result.rows.filter((r) => r.ok).map((r) => r.data.id)
  const { data: existingQuestions } = ids.length ? await admin.from('questions').select('id').in('id', ids) : { data: [] as { id: string }[] }
  const existingIds = (existingQuestions ?? []).map((r: { id: string }) => r.id)

  return NextResponse.json({
    filename: file.name,
    totalRows: result.rows.length,
    validCount: result.validCount,
    errorCount: result.errorCount,
    duplicateIds: result.duplicateIds,
    existingIds,
    rows: result.rows,
  })
}
