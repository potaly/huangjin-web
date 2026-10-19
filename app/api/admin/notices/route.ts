// GET/POST /api/admin/notices — 公告管理
import { addLog, handle, ok, pageParams, paginate, readJson, requireAdmin, requireString, toBool, toInt } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import { sanitizeHtml, htmlToText } from '@/lib/sanitize'
import { noticeVisible } from '@/lib/mall'
import type { Notice } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const statusParam = url.searchParams.get('status')

    let rows = db.notice.filter((n) => !n.deleted)
    if (keyword) rows = rows.filter((n) => n.title.toLowerCase().includes(keyword))
    if (statusParam !== null && statusParam !== '') {
      rows = rows.filter((n) => n.status === Number(statusParam))
    }

    rows = [...rows].sort((a, b) => {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
      return new Date(b.publishAt ?? b.createdAt).getTime() - new Date(a.publishAt ?? a.createdAt).getTime()
    })

    const page = paginate(rows, pageNum, pageSize)
    return ok({
      ...page,
      records: page.records.map((n) => ({
        ...n,
        summary: htmlToText(n.contentHtml, 50),
        visible: noticeVisible(n),
      })),
    })
  })
}

function readBody(body: Partial<Notice>) {
  return {
    title: requireString(body.title, '公告标题', 100),
    cover: body.cover ? String(body.cover).slice(0, 500) : undefined,
    contentHtml: sanitizeHtml(body.contentHtml),
    isTop: toBool(body.isTop),
    isPopup: toBool(body.isPopup),
    status: ([0, 1, 2].includes(toInt(body.status, 0)) ? toInt(body.status, 0) : 0) as 0 | 1 | 2,
    publishAt: body.publishAt ? new Date(String(body.publishAt)).toISOString() : undefined,
    expireAt: body.expireAt ? new Date(String(body.expireAt)).toISOString() : undefined,
  }
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('content')
    const body = await readJson<Partial<Notice>>(req)
    const fields = readBody(body)

    const created = await mutate((db) => {
      const ts = new Date().toISOString()
      const notice: Notice = {
        id: nextId(db, 'notice'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        ...fields,
        // 发布但未指定生效时间时，以保存时间为生效时间
        publishAt: fields.publishAt ?? (fields.status === 1 ? ts : undefined),
      }
      db.notice.push(notice)
      addLog(db, session, { module: '公告', action: '新增', requestUri: '/api/admin/notices', requestBody: { title: notice.title } })
      return notice
    })
    return ok(created, '新增成功')
  })
}
