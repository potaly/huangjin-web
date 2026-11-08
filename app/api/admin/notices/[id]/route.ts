// GET/PUT/DELETE /api/admin/notices/{id}
import { addLog, handle, ok, readJson, requireAdmin, requireId } from '@/lib/api'
import { deleteNotice, getNotice, updateNotice, type NoticeInput } from '@/lib/content-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    return ok(getNotice(db, requireId(params.id)))
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    const body = await readJson<NoticeInput>(req)
    const updated = await mutate((db) => {
      const notice = updateNotice(db, id, body, session)
      addLog(db, session, { module: '公告', action: '编辑', requestUri: `/api/admin/notices/${id}`, requestBody: { title: notice.title, status: notice.status } })
      return notice
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    await mutate((db) => {
      deleteNotice(db, id)
      addLog(db, session, { module: '公告', action: '删除', requestUri: `/api/admin/notices/${id}` })
    })
    return ok(true, '删除成功')
  })
}
