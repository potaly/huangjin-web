// GET/POST /api/mall/manage/notices — 公告分页与新增
import { addLog, handle, ok, pageParams, readJson } from '@/lib/api'
import { createNotice, listNotices, type NoticeInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
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
    const body = await readJson<NoticeInput>(req)
    const created = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const notice = createNotice(db, body, actor)
      addLog(db, actor, { module: '公告', action: '新增', requestUri: '/api/mall/manage/notices', requestBody: { title: notice.title } })
      return notice
    })
    return ok(created, '新增成功')
  })
}
