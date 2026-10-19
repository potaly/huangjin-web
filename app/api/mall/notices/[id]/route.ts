// GET /api/mall/notices/{id} — 公告详情
import { handle, notFound, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { noticeDetail, noticeVisible } from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const db = await loadDB()
    const id = requireId(params.id, '公告 ID')
    const notice = db.notice.find((n) => n.id === id)
    if (!notice || !noticeVisible(notice)) throw notFound('公告不存在或已下线')
    return ok(noticeDetail(notice))
  })
}
