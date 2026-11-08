// GET /api/mall/manage/stock-logs/export — 导出库存流水 CSV（Bearer 鉴权，失败返回 HTTP 401/403）
import { BizError } from '@/lib/api'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'
import { filterLogs, stockLogsCsv, stockLogsFilename } from '@/lib/stock-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const db = await loadDB()
  try {
    requireMallUser(db, MANAGE_ROLES)
  } catch (e) {
    if (e instanceof BizError && (e.status === 401 || e.status === 403)) {
      return new Response(e.message, { status: e.status })
    }
    throw e
  }

  const rows = filterLogs(db.stockLog, new URL(req.url))
  return new Response(stockLogsCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stockLogsFilename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
