// ────────────────────────────────────────────────────────────────
// 商品写入服务：商品 + SKU 一起保存，初始库存自动生成入库流水
// 需求文档 §5.1 商品编辑表单
// ────────────────────────────────────────────────────────────────

import type { AdminSession, DB, Product, ProductAttr, Sku } from './types'
import { bad, notFound, requireString, toInt, toStatus, toBool } from './api'
import { nextId } from './store'
import { applyStockChange } from './stock'
import { compareWeight, parseWeight } from './num'
import { sanitizeHtml } from './sanitize'

export interface SkuInput {
  id?: number
  skuCode?: string
  specName?: string
  refWeight?: unknown
  refQty?: unknown
  warnWeight?: unknown
  status?: unknown
  /** 仅新建 SKU 时生效：初始库存克数，保存后自动写入一条入库流水 */
  initialWeight?: unknown
  /** 标记删除 */
  _deleted?: boolean
}

export interface ProductInput {
  name?: string
  styleNo?: string
  categoryId?: unknown
  materialId?: unknown
  cover?: string
  images?: unknown
  purity?: string
  sizeDesc?: string
  attrs?: unknown
  detailHtml?: string
  isRecommend?: unknown
  status?: unknown
  sort?: unknown
  skus?: SkuInput[]
}

function normalizeAttrs(input: unknown): ProductAttr[] {
  if (!Array.isArray(input)) return []
  return input
    .map((a) => ({
      name: String((a as ProductAttr)?.name ?? '').trim().slice(0, 30),
      value: String((a as ProductAttr)?.value ?? '').trim().slice(0, 200),
    }))
    .filter((a) => a.name && a.value)
    .slice(0, 20)
}

function normalizeImages(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, 9)
}

/** 上架校验：至少一个启用 SKU、主图已上传 */
function assertPublishable(product: Product, skus: Sku[]): void {
  if (product.status !== 1) return
  if (!product.cover) throw bad('上架前请先上传主图')
  if (!skus.some((s) => s.status === 1 && !s.deleted)) throw bad('上架前请至少启用一个 SKU')
}

function applySkuInputs(
  db: DB,
  product: Product,
  inputs: SkuInput[],
  session: AdminSession,
): void {
  const ts = new Date().toISOString()
  const existing = db.productSku.filter((s) => s.productId === product.id && !s.deleted)

  // 删除
  for (const input of inputs) {
    if (!input._deleted || !input.id) continue
    const sku = existing.find((s) => s.id === input.id)
    if (!sku) continue
    if (compareWeight(sku.stockWeight, 0) !== 0) {
      throw bad(`SKU「${sku.specName}」仍有 ${sku.stockWeight} g 库存，请先出库或盘点为 0 再删除`)
    }
    sku.deleted = true
    sku.updatedAt = ts
    sku.updatedBy = session.username
  }

  const live = inputs.filter((i) => !i._deleted)
  if (live.length === 0) throw bad('至少需要一个 SKU')

  const seenCodes = new Set<string>()

  for (const input of live) {
    const specName = requireString(input.specName, 'SKU 规格名', 50)
    const skuCode = requireString(input.skuCode, 'SKU 编码', 50)
    if (seenCodes.has(skuCode)) throw bad(`SKU 编码 ${skuCode} 在本次提交中重复`)
    seenCodes.add(skuCode)

    const duplicated = db.productSku.some(
      (s) => !s.deleted && s.skuCode === skuCode && s.id !== input.id,
    )
    if (duplicated) throw bad(`SKU 编码 ${skuCode} 已被占用`)

    const refWeight = parseWeight(input.refWeight)
    const refQtyRaw = input.refQty === '' || input.refQty == null ? null : Number(input.refQty)
    const refQty = refQtyRaw != null && Number.isFinite(refQtyRaw) ? Math.max(0, Math.trunc(refQtyRaw)) : null
    const warnWeight = parseWeight(input.warnWeight) ?? 0
    if (warnWeight < 0) throw bad('预警克数不能为负数')

    if (input.id) {
      const sku = db.productSku.find((s) => s.id === input.id && !s.deleted)
      if (!sku) throw notFound(`SKU #${input.id} 不存在`)
      sku.skuCode = skuCode
      sku.specName = specName
      sku.refWeight = refWeight
      sku.refQty = refQty
      sku.warnWeight = warnWeight
      sku.status = toStatus(input.status, sku.status)
      sku.updatedAt = ts
      sku.updatedBy = session.username
      // 库存克数不在商品表单里改，必须走库存管理，保证流水完整
    } else {
      const sku: Sku = {
        id: nextId(db, 'productSku'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        productId: product.id,
        skuCode,
        specName,
        refWeight,
        refQty,
        stockWeight: 0,
        lockedWeight: 0,
        warnWeight,
        minOrderWeight: null,
        stepWeight: null,
        status: toStatus(input.status),
        version: 0,
      }
      db.productSku.push(sku)

      const initial = parseWeight(input.initialWeight)
      if (initial != null && compareWeight(initial, 0) > 0) {
        applyStockChange(db, {
          skuId: sku.id,
          type: 'IN',
          changeWeight: initial,
          reason: '商品建档初始入库',
          refNo: `INIT-${product.styleNo}`,
          operator: session.realName || session.username,
        })
      }
    }
  }
}

export function createProduct(db: DB, input: ProductInput, session: AdminSession): Product {
  const name = requireString(input.name, '商品名称', 100)
  const styleNo = requireString(input.styleNo, '款式编号', 50)
  const categoryId = toInt(input.categoryId, 0)
  const materialId = toInt(input.materialId, 0)

  if (db.product.some((p) => !p.deleted && p.styleNo === styleNo)) {
    throw bad(`款式编号 ${styleNo} 已存在`)
  }
  if (!db.category.some((c) => c.id === categoryId && !c.deleted)) throw bad('请选择商品分类')
  if (!db.goldMaterial.some((m) => m.id === materialId && !m.deleted)) throw bad('请选择商品材质')

  const ts = new Date().toISOString()
  const product: Product = {
    id: nextId(db, 'product'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: session.username,
    updatedBy: session.username,
    deleted: false,
    name,
    styleNo,
    categoryId,
    materialId,
    cover: input.cover ? String(input.cover).trim() : undefined,
    images: normalizeImages(input.images),
    purity: input.purity ? String(input.purity).slice(0, 50) : undefined,
    sizeDesc: input.sizeDesc ? String(input.sizeDesc).slice(0, 200) : undefined,
    attrs: normalizeAttrs(input.attrs),
    detailHtml: sanitizeHtml(input.detailHtml),
    isRecommend: toBool(input.isRecommend),
    status: toStatus(input.status, 0),
    sort: toInt(input.sort, 100),
    laborFeePerG: null,
    extraFeePerG: null,
  }
  db.product.push(product)

  applySkuInputs(db, product, input.skus ?? [], session)
  assertPublishable(product, db.productSku.filter((s) => s.productId === product.id))
  return product
}

export function updateProduct(
  db: DB,
  id: number,
  input: ProductInput,
  session: AdminSession,
): Product {
  const product = db.product.find((p) => p.id === id && !p.deleted)
  if (!product) throw notFound('商品不存在')

  if (input.styleNo !== undefined) {
    const styleNo = requireString(input.styleNo, '款式编号', 50)
    if (db.product.some((p) => !p.deleted && p.styleNo === styleNo && p.id !== id)) {
      throw bad(`款式编号 ${styleNo} 已存在`)
    }
    product.styleNo = styleNo
  }
  if (input.name !== undefined) product.name = requireString(input.name, '商品名称', 100)
  if (input.categoryId !== undefined) {
    const categoryId = toInt(input.categoryId, 0)
    if (!db.category.some((c) => c.id === categoryId && !c.deleted)) throw bad('请选择商品分类')
    product.categoryId = categoryId
  }
  if (input.materialId !== undefined) {
    const materialId = toInt(input.materialId, 0)
    if (!db.goldMaterial.some((m) => m.id === materialId && !m.deleted)) throw bad('请选择商品材质')
    product.materialId = materialId
  }
  if (input.cover !== undefined) product.cover = String(input.cover ?? '').trim() || undefined
  if (input.images !== undefined) product.images = normalizeImages(input.images)
  if (input.purity !== undefined) product.purity = String(input.purity ?? '').slice(0, 50) || undefined
  if (input.sizeDesc !== undefined) product.sizeDesc = String(input.sizeDesc ?? '').slice(0, 200) || undefined
  if (input.attrs !== undefined) product.attrs = normalizeAttrs(input.attrs)
  if (input.detailHtml !== undefined) product.detailHtml = sanitizeHtml(input.detailHtml)
  if (input.isRecommend !== undefined) product.isRecommend = toBool(input.isRecommend)
  if (input.status !== undefined) product.status = toStatus(input.status, product.status)
  if (input.sort !== undefined) product.sort = toInt(input.sort, product.sort)

  product.updatedAt = new Date().toISOString()
  product.updatedBy = session.username

  if (input.skus !== undefined) applySkuInputs(db, product, input.skus, session)
  assertPublishable(product, db.productSku.filter((s) => s.productId === product.id))
  return product
}

/** 复制商品：款号加后缀、库存清零、默认下架 */
export function copyProduct(db: DB, id: number, session: AdminSession): Product {
  const source = db.product.find((p) => p.id === id && !p.deleted)
  if (!source) throw notFound('商品不存在')

  let suffix = 1
  let styleNo = `${source.styleNo}-C${suffix}`
  while (db.product.some((p) => !p.deleted && p.styleNo === styleNo)) {
    suffix += 1
    styleNo = `${source.styleNo}-C${suffix}`
  }

  const ts = new Date().toISOString()
  const product: Product = {
    ...source,
    id: nextId(db, 'product'),
    name: `${source.name}（副本）`,
    styleNo,
    status: 0,
    isRecommend: false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: session.username,
    updatedBy: session.username,
    attrs: source.attrs.map((a) => ({ ...a })),
    images: [...(source.images ?? [])],
  }
  db.product.push(product)

  const sourceSkus = db.productSku.filter((s) => s.productId === id && !s.deleted)
  sourceSkus.forEach((s, i) => {
    db.productSku.push({
      ...s,
      id: nextId(db, 'productSku'),
      productId: product.id,
      skuCode: `${styleNo}-${String(i + 1).padStart(2, '0')}`,
      stockWeight: 0,
      lockedWeight: 0,
      version: 0,
      createdAt: ts,
      updatedAt: ts,
      createdBy: session.username,
      updatedBy: session.username,
    })
  })
  return product
}
