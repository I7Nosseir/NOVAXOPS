import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getLatestGeneration } from '@/lib/ai-cache'
import type { AiEntityType } from '@/lib/ai-cache'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const entityType = searchParams.get('entity') as AiEntityType | null
  const entityId   = searchParams.get('id')
  const agentType  = searchParams.get('agent')

  if (!entityType || !entityId || !agentType) {
    return NextResponse.json({ error: 'entity, id, and agent are required' }, { status: 400 })
  }

  const db = createAdminClient()
  const saved = await getLatestGeneration(db, entityType, entityId, agentType)
  if (!saved) return NextResponse.json({ saved: null })

  return NextResponse.json({ saved })
}
