// ────────────────────────────────────────────────────────────────
// 前台视图模型
//
// 需求文档 §7.1 末尾明确：一期接口在后端就不得返回任何金价、工费、
// 价格字段，不能只靠前端隐藏。因此这里显式构造返回对象，而不是把
// 实体整个 spread 出去。
// ────────────────────────────────────────────────────────────────

import type { DB, Notice, Product, Sku, StockDisplayMode } from './types'
import { availableWeight, productStockLevel, stockLevelOf } from './stock'
import { sanitizeHtml, htmlToText } from './sanitize'

export function configMap(db: DB): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of db.sysConfig) {
    if (!c.deleted) map[c.configKey] = c.configValue
  }
  return map
}

export function stockDisplayMode(db: DB): StockDisplayMode {
  return configMap(db)['stock.display.mode'] === 'LEVEL' ? 'LEVEL' : 'EXACT'
}

/** 按 stock.display.mode 返回克数或等级，EXACT 下同时给出等级便于标色 */
function stockView(sku: Sku, mode: StockDisplayMode) {
  const level = stockLevelOf(sku)
  if (mode === 'LEVEL') return { level }
  return { level, availableWeight: availableWeight(sku) }
}

/** 公告是否「已发布且在生效时间内」 */
export function noticeVisible(n: Notice, at = Date.now()): boolean {
  if (n.deleted || n.status !== 1) return false
  if (n.publishAt && new Date(n.publishAt).getTime() > at) return false
  if (n.expireAt && new Date(n.expireAt).getTime() < at) return false
  return true
}

export function visibleNotices(db: DB): Notice[] {
  const at = Date.now()
  return db.notice
    .filter((n) => noticeVisible(n, at))
    .sort((a, b) => {
      if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
      const ta = new Date(a.publishAt ?? a.createdAt).getTime()
      const tb = new Date(b.publishAt ?? b.createdAt).getTime()
      return tb - ta
    })
}

export function noticeCard(n: Notice) {
  return {
    id: n.id,
    title: n.title,
    cover: n.cover,
    summary: htmlToText(n.contentHtml, 60),
    isTop: n.isTop,
    publishAt: n.publishAt ?? n.createdAt,
  }
}

export function noticeDetail(n: Notice) {
  return {
    id: n.id,
    title: n.title,
    cover: n.cover,
    contentHtml: sanitizeHtml(n.contentHtml),
    isTop: n.isTop,
    publishAt: n.publishAt ?? n.createdAt,
  }
}

/** 上架且未删除 */
export function onSaleProducts(db: DB): Product[] {
  return db.product.filter((p) => !p.deleted && p.status === 1)
}

export function skusOf(db: DB, productId: number): Sku[] {
  return db.productSku
    .filter((s) => !s.deleted && s.productId === productId)
    .sort((a, b) => a.id - b.id)
}

/** 商品列表卡片：主图、名称、款号、材质、参考单件克重区间、库存 */
export function productCard(db: DB, p: Product, mode: StockDisplayMode) {
  const skus = skusOf(db, p.id)
  const active = skus.filter((s) => s.status === 1)
  const material = db.goldMaterial.find((m) => m.id === p.materialId)
  const category = db.category.find((c) => c.id === p.categoryId)

  const refWeights = active
    .map((s) => s.refWeight)
    .filter((w): w is number => typeof w === 'number' && w > 0)

  const totalAvailable = active.reduce((sum, s) => sum + availableWeight(s), 0)
  const level = productStockLevel(skus)

  return {
    id: p.id,
    name: p.name,
    styleNo: p.styleNo,
    cover: p.cover,
    categoryId: p.categoryId,
    categoryName: category?.name ?? '',
    materialId: p.materialId,
    materialName: material?.name ?? '',
    isRecommend: p.isRecommend,
    refWeightMin: refWeights.length ? Math.min(...refWeights) : null,
    refWeightMax: refWeights.length ? Math.max(...refWeights) : null,
    skuCount: active.length,
    stockLevel: level,
    soldOut: level === 'SOLD_OUT',
    ...(mode === 'EXACT' ? { availableWeight: Number(totalAvailable.toFixed(3)) } : {}),
    createdAt: p.createdAt,
  }
}

/** 商品详情：属性、SKU 列表与库存，仍不含任何价格字段 */
export function productDetail(db: DB, p: Product, mode: StockDisplayMode) {
  const skus = skusOf(db, p.id).filter((s) => s.status === 1)
  const material = db.goldMaterial.find((m) => m.id === p.materialId)
  const category = db.category.find((c) => c.id === p.categoryId)
  const parent = category ? db.category.find((c) => c.id === category.parentId) : undefined

  const images = [p.cover, ...(p.images ?? [])].filter(
    (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i,
  )

  return {
    id: p.id,
    name: p.name,
    styleNo: p.styleNo,
    cover: p.cover,
    images,
    categoryId: p.categoryId,
    categoryName: category?.name ?? '',
    parentCategoryName: parent?.name ?? '',
    materialName: material?.name ?? '',
    purity: p.purity ?? material?.purity ?? '',
    sizeDesc: p.sizeDesc ?? '',
    attrs: p.attrs ?? [],
    detailHtml: sanitizeHtml(p.detailHtml),
    isRecommend: p.isRecommend,
    stockLevel: productStockLevel(skusOf(db, p.id)),
    stockDisplayMode: mode,
    skus: skus.map((s) => ({
      id: s.id,
      skuCode: s.skuCode,
      specName: s.specName,
      refWeight: s.refWeight ?? null,
      refQty: s.refQty ?? null,
      ...stockView(s, mode),
    })),
  }
}

/** 分类树，仅返回启用项，自动过滤没有在售商品的空二级分类 */
export function categoryTree(db: DB, opts: { onlyWithProducts?: boolean } = {}) {
  const products = onSaleProducts(db)
  const countOf = (categoryId: number) =>
    products.filter((p) => p.categoryId === categoryId).length

  return db.category
    .filter((c) => !c.deleted && c.status === 1 && c.parentId === 0)
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((parent) => {
      const children = db.category
        .filter((c) => !c.deleted && c.status === 1 && c.parentId === parent.id)
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, productCount: countOf(c.id) }))
        .filter((c) => (opts.onlyWithProducts ? c.productCount > 0 : true))

      return {
        id: parent.id,
        name: parent.name,
        icon: parent.icon,
        productCount: children.reduce((s, c) => s + c.productCount, 0) + countOf(parent.id),
        children,
      }
    })
}

/** 子分类 id 集合（含自身），用于按一级分类筛选商品 */
export function categoryScope(db: DB, categoryId: number): number[] {
  const ids = [categoryId]
  for (const c of db.category) {
    if (!c.deleted && c.parentId === categoryId) ids.push(c.id)
  }
  return ids
}

/** 前台公开参数（§7.1 /settings/public） */
export function publicSettings(db: DB) {
  const cfg = configMap(db)
  return {
    siteName: cfg['site.name'] ?? '黄金首饰批发商城',
    siteSlogan: cfg['site.slogan'] ?? '',
    contactPhone: cfg['contact.phone'] ?? '',
    contactWechat: cfg['contact.wechat'] ?? '',
    contactWechatQrcode: cfg['contact.wechat.qrcode'] ?? '',
    contactWorkTime: cfg['contact.work.time'] ?? '',
    companyAddress: cfg['company.address'] ?? '',
    stockDisplayMode: stockDisplayMode(db),
  }
}
