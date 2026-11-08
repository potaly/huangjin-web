// GET/POST /api/admin/notices — 公告管理
import { addLog, handle, ok, pageParams, readJson, requireAdmin } from '@/lib/api'
import { createNotice, listNotices, type NoticeInput } from '@/lib/content-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    return ok(listNotices(db, {
      keyword: url.searchParams.get('keyword') ?? '',
      status: url.searchParams.get('status'),
      pageNum,
      pageSize,
    }))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('content')
    const body = await readJson<NoticeInput>(req)
    const created = await mutate((db) => {
      const notice = createNotice(db, body, session)
      addLog(db, session, { module: '公告', action: '新增', requestUri: '/api/admin/notices', requestBody: { title: notice.title } })
      return notice
    })
    return ok(created, '新增成功')
  })
}
