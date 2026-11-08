// GET/PUT/DELETE /api/mall/manage/notices/{id}
import { addLog, handle, ok, readJson, requireId } from '@/lib/api'
import { deleteNotice, getNotice, updateNotice, type NoticeInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(getNotice(db, requireId(params.id)))
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<NoticeInput>(req)
    const updated = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const notice = updateNotice(db, id, body, actor)
      addLog(db, actor, { module: '公告', action: '编辑', requestUri: `/api/mall/manage/notices/${id}`, requestBody: { title: notice.title, status: notice.status } })
      return notice
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      deleteNotice(db, id)
      addLog(db, actor, { module: '公告', action: '删除', requestUri: `/api/mall/manage/notices/${id}` })
    })
    return ok(true, '删除成功')
  })
}
