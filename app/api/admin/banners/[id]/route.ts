// PUT/DELETE /api/admin/banners/{id}
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, requireString, toInt, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'
import type { Banner, BannerLinkType } from '@/lib/types'

export const dynamic = 'force-dynamic'

const LINK_TYPES: BannerLinkType[] = ['NONE', 'PRODUCT', 'NOTICE', 'URL']

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    const body = await readJson<Partial<Banner>>(req)

    const updated = await mutate((db) => {
      const banner = db.banner.find((b) => b.id === id && !b.deleted)
      if (!banner) throw notFound('轮播图不存在')

      if (body.image !== undefined) banner.image = requireString(body.image, '轮播图片', 500)
      if (body.title !== undefined) banner.title = String(body.title ?? '').slice(0, 50) || undefined
      if (body.linkType !== undefined) {
        banner.linkType = (LINK_TYPES.includes(body.linkType as BannerLinkType)
          ? body.linkType
          : 'NONE') as BannerLinkType
      }
      if (body.linkValue !== undefined) {
        banner.linkValue = String(body.linkValue ?? '').trim().slice(0, 500) || undefined
      }
      if (banner.linkType !== 'NONE' && !banner.linkValue) throw bad('请填写跳转目标')
      if (banner.linkType === 'URL' && banner.linkValue && !/^https?:\/\//i.test(banner.linkValue)) {
        throw bad('外链必须以 http:// 或 https:// 开头')
      }
      if (body.sort !== undefined) banner.sort = toInt(body.sort, banner.sort)
      if (body.status !== undefined) banner.status = toStatus(body.status, banner.status)

      banner.updatedAt = new Date().toISOString()
      banner.updatedBy = session.username
      addLog(db, session, { module: '轮播图', action: '编辑', requestUri: `/api/admin/banners/${id}`, requestBody: body })
      return banner
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    await mutate((db) => {
      const banner = db.banner.find((b) => b.id === id && !b.deleted)
      if (!banner) throw notFound('轮播图不存在')
      banner.deleted = true
      banner.updatedAt = new Date().toISOString()
      addLog(db, session, { module: '轮播图', action: '删除', requestUri: `/api/admin/banners/${id}` })
    })
    return ok(true, '删除成功')
  })
}
