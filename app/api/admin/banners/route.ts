// GET/POST /api/admin/banners — 首页轮播图
import { addLog, bad, handle, ok, readJson, requireAdmin, requireString, toInt, toStatus } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import type { Banner, BannerLinkType } from '@/lib/types'

export const dynamic = 'force-dynamic'

const LINK_TYPES: BannerLinkType[] = ['NONE', 'PRODUCT', 'NOTICE', 'URL']

export async function GET() {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    const records = db.banner
      .filter((b) => !b.deleted)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
    return ok(records)
  })
}

function readLink(body: Partial<Banner>) {
  const linkType = (LINK_TYPES.includes(body.linkType as BannerLinkType)
    ? body.linkType
    : 'NONE') as BannerLinkType
  const linkValue = body.linkValue ? String(body.linkValue).trim().slice(0, 500) : undefined
  if (linkType !== 'NONE' && !linkValue) throw bad('请填写跳转目标')
  if (linkType === 'URL' && linkValue && !/^https?:\/\//i.test(linkValue)) {
    throw bad('外链必须以 http:// 或 https:// 开头')
  }
  if ((linkType === 'PRODUCT' || linkType === 'NOTICE') && linkValue && !/^\d+$/.test(linkValue)) {
    throw bad('商品 / 公告跳转请填写对应的 ID')
  }
  return { linkType, linkValue }
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('content')
    const body = await readJson<Partial<Banner>>(req)
    const image = requireString(body.image, '轮播图片', 500)
    const { linkType, linkValue } = readLink(body)

    const created = await mutate((db) => {
      const ts = new Date().toISOString()
      const banner: Banner = {
        id: nextId(db, 'banner'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        image,
        title: body.title ? String(body.title).slice(0, 50) : undefined,
        linkType,
        linkValue,
        sort: toInt(body.sort, 100),
        status: toStatus(body.status),
      }
      db.banner.push(banner)
      addLog(db, session, { module: '轮播图', action: '新增', requestUri: '/api/admin/banners', requestBody: body })
      return banner
    })
    return ok(created, '新增成功')
  })
}
