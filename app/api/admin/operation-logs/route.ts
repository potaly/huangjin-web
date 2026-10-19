// GET /api/admin/operation-logs — 操作日志
import { handle, ok, pageParams, paginate, requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('system')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const moduleName = (url.searchParams.get('module') ?? '').trim()

    let rows = [...db.sysOperationLog]
    if (keyword) {
      rows = rows.filter(
        (l) =>
          l.adminName.toLowerCase().includes(keyword) ||
          l.action.toLowerCase().includes(keyword) ||
          l.requestUri.toLowerCase().includes(keyword),
      )
    }
    if (moduleName) rows = rows.filter((l) => l.module === moduleName)

    return ok({
      ...paginate(rows, pageNum, pageSize),
      modules: Array.from(new Set(db.sysOperationLog.map((l) => l.module))),
    })
  })
}
