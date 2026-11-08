// GET /api/admin/operation-logs — 操作日志
import { handle, ok, requireAdmin } from '@/lib/api'
import { queryOperationLogs } from '@/lib/config-service'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('system')
    const db = await loadDB()
    return ok(queryOperationLogs(db, new URL(req.url)))
  })
}
