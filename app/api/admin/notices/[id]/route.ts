// GET/PUT/DELETE /api/admin/notices/{id}
import { addLog, handle, notFound, ok, readJson, requireAdmin, requireId, requireString, toBool, toInt } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { sanitizeHtml } from '@/lib/sanitize'
import type { Notice } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    const notice = db.notice.find((n) => n.id === requireId(params.id) && !n.deleted)
    if (!notice) throw notFound('公告不存在')
    return ok(notice)
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    const body = await readJson<Partial<Notice>>(req)

    const updated = await mutate((db) => {
      const notice = db.notice.find((n) => n.id === id && !n.deleted)
      if (!notice) throw notFound('公告不存在')

      if (body.title !== undefined) notice.title = requireString(body.title, '公告标题', 100)
      if (body.cover !== undefined) notice.cover = String(body.cover ?? '').slice(0, 500) || undefined
      if (body.contentHtml !== undefined) notice.contentHtml = sanitizeHtml(body.contentHtml)
      if (body.isTop !== undefined) notice.isTop = toBool(body.isTop)
      if (body.isPopup !== undefined) notice.isPopup = toBool(body.isPopup)
      if (body.status !== undefined) {
        const next = toInt(body.status, notice.status)
        if ([0, 1, 2].includes(next)) notice.status = next as 0 | 1 | 2
        if (notice.status === 1 && !notice.publishAt) notice.publishAt = new Date().toISOString()
      }
      if (body.publishAt !== undefined) {
        notice.publishAt = body.publishAt ? new Date(String(body.publishAt)).toISOString() : undefined
      }
      if (body.expireAt !== undefined) {
        notice.expireAt = body.expireAt ? new Date(String(body.expireAt)).toISOString() : undefined
      }

      notice.updatedAt = new Date().toISOString()
      notice.updatedBy = session.username
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
      const notice = db.notice.find((n) => n.id === id && !n.deleted)
      if (!notice) throw notFound('公告不存在')
      notice.deleted = true
      notice.updatedAt = new Date().toISOString()
      addLog(db, session, { module: '公告', action: '删除', requestUri: `/api/admin/notices/${id}` })
    })
    return ok(true, '删除成功')
  })
}
