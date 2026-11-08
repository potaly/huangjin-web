// GET /api/mall/manage/operation-logs — 操作日志（仅老板）
import { handle, ok } from '@/lib/api'
import { queryOperationLogs } from '@/lib/config-service'
import { requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, ['OWNER'])
    return ok(queryOperationLogs(db, new URL(req.url)))
  })
}
