import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseImportFile } from '@/lib/excel-import'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

export async function POST(req: Request) {
  const adminUser = await requireAdmin().catch(() => null)
  if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 128 * 1024) {
    return NextResponse.json({ error: 'Request exceeds the 10MB upload limit.' }, { status: 413 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'File is empty.' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'File exceeds the 10MB limit.' }, { status: 413 })

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: 'Unsupported file type. Use .xlsx, .xls, or .csv.' }, { status: 400 })

    const admin = createAdminClient()
    const { data: programs, error: programError } = await admin.from('programs').select('id,slug')
    if (programError) throw programError
    const programMap = new Map((programs ?? []).flatMap((p: { id: string; slug: string }) => [[p.id.toLowerCase(), p.id], [p.slug.toLowerCase(), p.id]] as [string, string][]))

    const buffer = await file.arrayBuffer()
    const result = parseImportFile(buffer, [...programMap.keys()])
    result.rows = result.rows.map(row => row.ok ? { ...row, data: { ...row.data, programId: programMap.get(row.data.programId.toLowerCase()) ?? row.data.programId } } : row)
    if (!result.rows.length) return NextResponse.json({ error: 'No rows found. Check the import template.' }, { status: 400 })

    const ids = result.rows.filter(r => r.ok).map(r => r.data.id)
    const { data: existingQuestions, error: existingError } = ids.length ? await admin.from('questions').select('id').in('id', ids) : { data: [] as { id: string }[], error: null }
    if (existingError) throw existingError

    return NextResponse.json({ filename: file.name, totalRows: result.rows.length, validCount: result.validCount, errorCount: result.errorCount, duplicateIds: result.duplicateIds, existingIds: (existingQuestions ?? []).map(r => r.id), rows: result.rows })
  } catch {
    console.error('[questions/import/parse] failed')
    return NextResponse.json({ error: 'Could not parse the uploaded file.' }, { status: 400 })
  }
}
