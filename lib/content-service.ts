// ────────────────────────────────────────────────────────────────
// 内容模块写入服务：分类 / 材质 / 公告 / 轮播图
// PC 后台与小程序管理端共用；操作日志留在路由里写
// ────────────────────────────────────────────────────────────────

import type { AdminSession, Banner, BannerLinkType, Category, DB, Material, Notice, Page } from './types'
import { bad, notFound, paginate, requireString, toBool, toInt, toStatus } from './api'
import { nextId } from './store'
import { sanitizeHtml, htmlToText } from './sanitize'
import { noticeVisible } from './mall'

// ── 分类 ────────────────────────────────────────────────────────

export type CategoryInput = Partial<Category>

/** 两级分类树，带商品数 */
export function categoryTree(db: DB) {
  const all = db.category.filter((c) => !c.deleted)
  const countOf = (id: number) => db.product.filter((p) => !p.deleted && p.categoryId === id).length
  return all
    .filter((c) => c.parentId === 0)
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((parent) => ({
      ...parent,
      productCount: countOf(parent.id),
      children: all
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map((c) => ({ ...c, productCount: countOf(c.id) })),
    }))
}

export function createCategory(db: DB, body: CategoryInput, session: AdminSession): Category {
  const name = requireString(body.name, '分类名称', 50)
  const parentId = toInt(body.parentId, 0)
  if (parentId !== 0) {
    const parent = db.category.find((c) => c.id === parentId && !c.deleted)
    if (!parent) throw bad('上级分类不存在')
    if (parent.parentId !== 0) throw bad('分类最多两级')
  }
  if (db.category.some((c) => !c.deleted && c.parentId === parentId && c.name === name)) {
    throw bad('同级下已存在同名分类')
  }
  const ts = new Date().toISOString()
  const category: Category = {
    id: nextId(db, 'category'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: session.username,
    updatedBy: session.username,
    deleted: false,
    parentId,
    name,
    icon: body.icon ? String(body.icon).slice(0, 500) : undefined,
    sort: toInt(body.sort, 100),
    status: toStatus(body.status),
  }
  db.category.push(category)
  return category
}

export function updateCategory(db: DB, id: number, body: CategoryInput, session: AdminSession): Category {
  const category = db.category.find((c) => c.id === id && !c.deleted)
  if (!category) throw notFound('分类不存在')

  if (body.name !== undefined) {
    const name = requireString(body.name, '分类名称', 50)
    if (db.category.some((c) => !c.deleted && c.parentId === category.parentId && c.name === name && c.id !== id)) {
      throw bad('同级下已存在同名分类')
    }
    category.name = name
  }
  if (body.icon !== undefined) category.icon = String(body.icon ?? '').slice(0, 500) || undefined
  if (body.sort !== undefined) category.sort = toInt(body.sort, category.sort)
  if (body.status !== undefined) {
    category.status = toStatus(body.status, category.status)
    // 停用一级分类时同步停用其二级分类
    if (category.status === 0 && category.parentId === 0) {
      for (const child of db.category) {
        if (!child.deleted && child.parentId === id) child.status = 0
      }
    }
  }
  category.updatedAt = new Date().toISOString()
  category.updatedBy = session.username
  return category
}

export function deleteCategory(db: DB, id: number): void {
  const category = db.category.find((c) => c.id === id && !c.deleted)
  if (!category) throw notFound('分类不存在')
  const children = db.category.filter((c) => !c.deleted && c.parentId === id).length
  if (children > 0) throw bad(`请先删除该分类下的 ${children} 个二级分类`)
  const used = db.product.filter((p) => !p.deleted && p.categoryId === id).length
  if (used > 0) throw bad(`该分类下还有 ${used} 个商品，不能删除`)
  category.deleted = true
  category.updatedAt = new Date().toISOString()
}

// ── 材质 ────────────────────────────────────────────────────────

export type MaterialInput = Partial<Material>

export function listMaterials(db: DB) {
  return db.goldMaterial
    .filter((m) => !m.deleted)
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((m) => ({
      ...m,
      productCount: db.product.filter((p) => !p.deleted && p.materialId === m.id).length,
    }))
}

export function createMaterial(db: DB, body: MaterialInput, session: AdminSession): Material {
  const code = requireString(body.code, '材质编码', 30).toUpperCase()
  const name = requireString(body.name, '材质名称', 50)
  if (db.goldMaterial.some((m) => !m.deleted && m.code === code)) {
    throw bad(`材质编码 ${code} 已存在`)
  }
  const ts = new Date().toISOString()
  const material: Material = {
    id: nextId(db, 'goldMaterial'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: session.username,
    updatedBy: session.username,
    deleted: false,
    code,
    name,
    purity: body.purity ? String(body.purity).slice(0, 30) : undefined,
    sort: toInt(body.sort, 100),
    status: toStatus(body.status),
  }
  db.goldMaterial.push(material)
  return material
}

export function updateMaterial(db: DB, id: number, body: MaterialInput, session: AdminSession): Material {
  const material = db.goldMaterial.find((m) => m.id === id && !m.deleted)
  if (!material) throw notFound('材质不存在')

  if (body.code !== undefined) {
    const code = requireString(body.code, '材质编码', 30).toUpperCase()
    if (db.goldMaterial.some((m) => !m.deleted && m.code === code && m.id !== id)) {
      throw bad(`材质编码 ${code} 已存在`)
    }
    material.code = code
  }
  if (body.name !== undefined) material.name = requireString(body.name, '材质名称', 50)
  if (body.purity !== undefined) material.purity = String(body.purity).slice(0, 30)
  if (body.sort !== undefined) material.sort = toInt(body.sort, material.sort)
  if (body.status !== undefined) material.status = toStatus(body.status, material.status)

  material.updatedAt = new Date().toISOString()
  material.updatedBy = session.username
  return material
}

export function deleteMaterial(db: DB, id: number, session: AdminSession): void {
  const material = db.goldMaterial.find((m) => m.id === id && !m.deleted)
  if (!material) throw notFound('材质不存在')
  const used = db.product.filter((p) => !p.deleted && p.materialId === id).length
  if (used > 0) throw bad(`该材质已被 ${used} 个商品使用，不能删除，可改为停用`)
  material.deleted = true
  material.updatedAt = new Date().toISOString()
  material.updatedBy = session.username
}

// ── 公告 ────────────────────────────────────────────────────────

export type NoticeInput = Partial<Notice>

export interface NoticeQuery {
  keyword?: string
  /** 空串 / null / undefined 表示不过滤 */
  status?: string | null
  pageNum: number
  pageSize: number
}

export function listNotices(db: DB, q: NoticeQuery) {
  const keyword = (q.keyword ?? '').trim().toLowerCase()
  let rows = db.notice.filter((n) => !n.deleted)
  if (keyword) rows = rows.filter((n) => n.title.toLowerCase().includes(keyword))
  if (q.status !== null && q.status !== undefined && q.status !== '') {
    rows = rows.filter((n) => n.status === Number(q.status))
  }
  rows = [...rows].sort((a, b) => {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
    return new Date(b.publishAt ?? b.createdAt).getTime() - new Date(a.publishAt ?? a.createdAt).getTime()
  })
  const page = paginate(rows, q.pageNum, q.pageSize)
  return {
    ...page,
    records: page.records.map((n) => ({
      ...n,
      summary: htmlToText(n.contentHtml, 50),
      visible: noticeVisible(n),
    })),
  } as Page<Notice & { summary: string; visible: boolean }>
}

export function getNotice(db: DB, id: number): Notice {
  const notice = db.notice.find((n) => n.id === id && !n.deleted)
  if (!notice) throw notFound('公告不存在')
  return notice
}

function readNoticeFields(body: NoticeInput) {
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

export function createNotice(db: DB, body: NoticeInput, session: AdminSession): Notice {
  const fields = readNoticeFields(body)
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
  return notice
}

export function updateNotice(db: DB, id: number, body: NoticeInput, session: AdminSession): Notice {
  const notice = getNotice(db, id)

  if (body.title !== undefined) notice.title = requireString(body.title, '公告标题', 100)
  if (body.cover !== undefined) notice.cover = String(body.cover ?? '').slice(0, 500) || undefined
  if (body.contentHtml !== undefined) notice.contentHtml = sanitizeHtml(body.contentHtml)
  if (body.isTop !== undefined) notice.isTop = toBool(body.isTop)
  if (body.isPopup !== undefined) notice.isPopup = toBool(body.isPopup)
  if (body.status !== undefined) {
    const next = toInt(body.status, notice.status)
    if ([0, 1, 2].includes(next)) notice.status = next as 0 | 1 | 2
  }
  if (body.publishAt !== undefined) {
    notice.publishAt = body.publishAt ? new Date(String(body.publishAt)).toISOString() : undefined
  }
  if (body.expireAt !== undefined) {
    notice.expireAt = body.expireAt ? new Date(String(body.expireAt)).toISOString() : undefined
  }
  // 发布状态必须有生效时间（放最后，避免被空串清掉）
  if (notice.status === 1 && !notice.publishAt) notice.publishAt = new Date().toISOString()

  notice.updatedAt = new Date().toISOString()
  notice.updatedBy = session.username
  return notice
}

export function deleteNotice(db: DB, id: number): void {
  const notice = getNotice(db, id)
  notice.deleted = true
  notice.updatedAt = new Date().toISOString()
}

// ── 轮播图 ──────────────────────────────────────────────────────

export type BannerInput = Partial<Banner>

const LINK_TYPES: BannerLinkType[] = ['NONE', 'PRODUCT', 'NOTICE', 'URL']

function normalizeLinkType(value: unknown): BannerLinkType {
  return (LINK_TYPES.includes(value as BannerLinkType) ? value : 'NONE') as BannerLinkType
}

/** 新增与编辑共用的跳转校验（编辑时对合并后的结果校验，因此编辑也会检查数字 ID） */
function assertBannerLink(linkType: BannerLinkType, linkValue: string | undefined): void {
  if (linkType !== 'NONE' && !linkValue) throw bad('请填写跳转目标')
  if (linkType === 'URL' && linkValue && !/^https?:\/\//i.test(linkValue)) {
    throw bad('外链必须以 http:// 或 https:// 开头')
  }
  if ((linkType === 'PRODUCT' || linkType === 'NOTICE') && linkValue && !/^\d+$/.test(linkValue)) {
    throw bad('商品 / 公告跳转请填写对应的 ID')
  }
}

export function listBanners(db: DB): Banner[] {
  return db.banner.filter((b) => !b.deleted).sort((a, b) => a.sort - b.sort || a.id - b.id)
}

export function createBanner(db: DB, body: BannerInput, session: AdminSession): Banner {
  const image = requireString(body.image, '轮播图片', 500)
  const linkType = normalizeLinkType(body.linkType)
  const linkValue = body.linkValue ? String(body.linkValue).trim().slice(0, 500) : undefined
  assertBannerLink(linkType, linkValue)

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
  return banner
}

export function updateBanner(db: DB, id: number, body: BannerInput, session: AdminSession): Banner {
  const banner = db.banner.find((b) => b.id === id && !b.deleted)
  if (!banner) throw notFound('轮播图不存在')

  if (body.image !== undefined) banner.image = requireString(body.image, '轮播图片', 500)
  if (body.title !== undefined) banner.title = String(body.title ?? '').slice(0, 50) || undefined
  if (body.linkType !== undefined) banner.linkType = normalizeLinkType(body.linkType)
  if (body.linkValue !== undefined) {
    banner.linkValue = String(body.linkValue ?? '').trim().slice(0, 500) || undefined
  }
  assertBannerLink(banner.linkType, banner.linkValue)
  if (body.sort !== undefined) banner.sort = toInt(body.sort, banner.sort)
  if (body.status !== undefined) banner.status = toStatus(body.status, banner.status)

  banner.updatedAt = new Date().toISOString()
  banner.updatedBy = session.username
  return banner
}

export function deleteBanner(db: DB, id: number): void {
  const banner = db.banner.find((b) => b.id === id && !b.deleted)
  if (!banner) throw notFound('轮播图不存在')
  banner.deleted = true
  banner.updatedAt = new Date().toISOString()
}
