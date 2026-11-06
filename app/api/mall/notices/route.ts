// GET /api/mall/notices — 公告列表（置顶在前）
import { handle, ok, pageParams, paginate } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallAccess } from '@/lib/mall-auth'
import { noticeCard, visibleNotices } from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallAccess(db)
    const { pageNum, pageSize } = pageParams(new URL(req.url))
    const records = visibleNotices(db).map(noticeCard)
    return ok(paginate(records, pageNum, pageSize))
  })
}
