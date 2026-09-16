import { NextResponse } from 'next/server'

// Kept as an explicit retirement response so old clients cannot bypass the hardened
// start/snapshot/submit workflow by posting a complete attempt payload.
export async function POST() {
  return NextResponse.json({ error: 'This endpoint is retired. Start an assessment through /api/attempts/start.' }, { status: 410 })
}
