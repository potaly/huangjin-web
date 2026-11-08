// 商品与库存管理的查询：PC 后台与小程序管理端共用
import { notFound } from './api'
import { sumWeight } from './num'
import { availableWeight, productStockLevel, stockLevelOf } from './stock'
import type { DB, Product } from './types'

export interface ProductFilter {
  keyword?: string
  categoryId?: number
  materialId?: number
  status?: 0 | 1
}

export function productFilterFromUrl(url: URL): ProductFilter {
  const statusParam = url.searchParams.get('status')
  return {
    keyword: url.searchParams.get('keyword') ?? '',
    categoryId: Number(url.searchParams.get('categoryId') ?? 0) || 0,
    materialId: Number(url.searchParams.get('materialId') ?? 0) || 0,
    status: statusParam === '0' || statusParam === '1' ? (Number(statusParam) as 0 | 1) : undefined,
  }
}

export function filterProducts(db: DB, filter: ProductFilter): Product[] {
  const keyword = (filter.keyword ?? '').trim().toLowerCase()
  let list = db.product.filter((p) => !p.deleted)
  if (keyword) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(keyword) || p.styleNo.toLowerCase().includes(keyword),
    )
  }
  if (filter.categoryId) {
    const scope = [
      filter.categoryId,
      ...db.category.filter((c) => c.parentId === filter.categoryId).map((c) => c.id),
    ]
    list = list.filter((p) => scope.includes(p.categoryId))
  }
  if (filter.materialId) list = list.filter((p) => p.materialId === filter.materialId)
  if (filter.status !== undefined) list = list.filter((p) => p.status === filter.status)
  return [...list].sort((a, b) => a.sort - b.sort || b.id - a.id)
}

export function productRow(db: DB, p: Product) {
  const skus = db.productSku.filter((s) => !s.deleted && s.productId === p.id)
  return {
    id: p.id,
    name: p.name,
    styleNo: p.styleNo,
    cover: p.cover,
    categoryName: db.category.find((c) => c.id === p.categoryId)?.name ?? '',
    materialName: db.goldMaterial.find((m) => m.id === p.materialId)?.name ?? '',
    isRecommend: p.isRecommend,
    status: p.status,
    sort: p.sort,
    skuCount: skus.length,
    stockWeight: sumWeight(skus.map((s) => s.stockWeight)),
    availableWeight: sumWeight(skus.map((s) => availableWeight(s))),
    stockLevel: productStockLevel(skus),
    updatedAt: p.updatedAt,
  }
}

export function productDetail(db: DB, id: number) {
  const product = db.product.find((p) => p.id === id && !p.deleted)
  if (!product) throw notFound('商品不存在')

  const skus = db.productSku
    .filter((s) => !s.deleted && s.productId === id)
    .sort((a, b) => a.id - b.id)
    .map((s) => ({
      id: s.id,
      skuCode: s.skuCode,
      specName: s.specName,
      refWeight: s.refWeight,
      refQty: s.refQty,
      stockWeight: s.stockWeight,
      lockedWeight: s.lockedWeight,
      availableWeight: availableWeight(s),
      warnWeight: s.warnWeight,
      status: s.status,
      level: stockLevelOf(s),
    }))

  return { ...product, skus }
}

/** 商品表单的选择器数据，含已停用项，编辑老商品时才能显示原值 */
export function productOptions(db: DB) {
  const all = db.category.filter((c) => !c.deleted)
  const bySort = <T extends { sort: number; id: number }>(a: T, b: T) => a.sort - b.sort || a.id - b.id
  const categories: Array<{ id: number; label: string; status: 0 | 1 }> = []
  for (const parent of all.filter((c) => c.parentId === 0).sort(bySort)) {
    categories.push({ id: parent.id, label: parent.name, status: parent.status })
    for (const child of all.filter((c) => c.parentId === parent.id).sort(bySort)) {
      categories.push({ id: child.id, label: `${parent.name} / ${child.name}`, status: child.status })
    }
  }
  const materials = db.goldMaterial
    .filter((m) => !m.deleted)
    .sort(bySort)
    .map((m) => ({ id: m.id, name: m.name, purity: m.purity, status: m.status }))
  return { categories, materials }
}

export interface StockFilter {
  keyword?: string
  materialId?: number
  onlyWarn?: boolean
}

export function stockFilterFromUrl(url: URL): StockFilter {
  return {
    keyword: url.searchParams.get('keyword') ?? '',
    materialId: Number(url.searchParams.get('materialId') ?? 0) || 0,
    onlyWarn: url.searchParams.get('onlyWarn') === '1',
  }
}

export function stockRows(db: DB, filter: StockFilter) {
  const keyword = (filter.keyword ?? '').trim().toLowerCase()
  let rows = db.productSku
    .filter((s) => !s.deleted)
    .map((s) => {
      const product = db.product.find((p) => p.id === s.productId)
      const material = db.goldMaterial.find((m) => m.id === product?.materialId)
      return {
        id: s.id,
        productId: s.productId,
        productName: product?.name ?? '',
        styleNo: product?.styleNo ?? '',
        cover: product?.cover ?? '',
        productStatus: product?.status ?? 0,
        materialId: product?.materialId ?? 0,
        materialName: material?.name ?? '',
        skuCode: s.skuCode,
        specName: s.specName,
        refWeight: s.refWeight,
        refQty: s.refQty,
        stockWeight: s.stockWeight,
        lockedWeight: s.lockedWeight,
        availableWeight: availableWeight(s),
        warnWeight: s.warnWeight,
        status: s.status,
        level: stockLevelOf(s),
        updatedAt: s.updatedAt,
      }
    })

  if (keyword) {
    rows = rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(keyword) ||
        r.styleNo.toLowerCase().includes(keyword) ||
        r.skuCode.toLowerCase().includes(keyword) ||
        r.specName.toLowerCase().includes(keyword),
    )
  }
  if (filter.materialId) rows = rows.filter((r) => r.materialId === filter.materialId)
  if (filter.onlyWarn) rows = rows.filter((r) => r.level !== 'ENOUGH')

  rows.sort((a, b) => a.productId - b.productId || a.id - b.id)
  return rows
}

export function stockSummary(rows: ReturnType<typeof stockRows>) {
  return {
    skuCount: rows.length,
    stockWeight: sumWeight(rows.map((r) => r.stockWeight)),
    lockedWeight: sumWeight(rows.map((r) => r.lockedWeight)),
    availableWeight: sumWeight(rows.map((r) => r.availableWeight)),
    warnCount: rows.filter((r) => r.level !== 'ENOUGH').length,
  }
}
