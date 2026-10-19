// ────────────────────────────────────────────────────────────────
// 库存服务（需求文档 §3.1）
//
// · 库存以 SKU 为单位，单位「克」，保留 3 位小数
// · 可售 = stock_weight − locked_weight
// · 每次库存变化都写一条流水，记录变化克数与变化前后克数
// ────────────────────────────────────────────────────────────────

import type { DB, Sku, StockLog, StockLogType, StockLevel } from './types'
import { addWeight, compareWeight, roundWeight } from './num'
import { nextId } from './store'
import { bad, notFound } from './api'

/** 可售克重 */
export function availableWeight(sku: Sku): number {
  return addWeight(sku.stockWeight, -sku.lockedWeight)
}

/** 前台库存等级：可售为 0 售罄，低于预警克数为少量，否则充足 */
export function stockLevelOf(sku: Sku): StockLevel {
  const available = availableWeight(sku)
  if (compareWeight(available, 0) <= 0) return 'SOLD_OUT'
  if (compareWeight(available, sku.warnWeight) < 0) return 'LOW'
  return 'ENOUGH'
}

/** 商品维度的库存等级：取各启用 SKU 中最好的那一档 */
export function productStockLevel(skus: Sku[]): StockLevel {
  const active = skus.filter((s) => s.status === 1)
  if (active.some((s) => stockLevelOf(s) === 'ENOUGH')) return 'ENOUGH'
  if (active.some((s) => stockLevelOf(s) === 'LOW')) return 'LOW'
  return 'SOLD_OUT'
}

export interface StockChange {
  skuId: number
  type: StockLogType
  /** 入库为正、出库为负；盘点调整传目标克重时用 targetWeight */
  changeWeight?: number
  /** 盘点调整：直接指定调整后的总克重 */
  targetWeight?: number
  reason: string
  refNo?: string
  operator: string
}

/**
 * 在给定事务（mutate 回调）内变更库存并写流水。
 * 返回写入的流水记录。
 */
export function applyStockChange(db: DB, change: StockChange): StockLog {
  const sku = db.productSku.find((s) => s.id === change.skuId && !s.deleted)
  if (!sku) throw notFound('SKU 不存在')

  const product = db.product.find((p) => p.id === sku.productId)

  const before = roundWeight(sku.stockWeight)
  let delta: number

  if (change.type === 'ADJUST') {
    if (change.targetWeight === undefined) throw bad('盘点调整必须填写调整后克重')
    if (compareWeight(change.targetWeight, 0) < 0) throw bad('调整后克重不能为负数')
    delta = addWeight(change.targetWeight, -before)
    if (compareWeight(delta, 0) === 0) throw bad('调整后克重与当前库存一致，无需调整')
  } else {
    if (change.changeWeight === undefined) throw bad('请填写变动克重')
    delta = roundWeight(change.changeWeight)
    if (compareWeight(delta, 0) === 0) throw bad('变动克重必须大于 0')
  }

  const after = addWeight(before, delta)
  if (compareWeight(after, 0) < 0) {
    throw bad(`库存不足：当前 ${before} g，无法出库 ${Math.abs(delta)} g`)
  }
  // 总库存不能低于已预占克重（二期下单后生效）
  if (compareWeight(after, sku.lockedWeight) < 0) {
    throw bad(`总库存不能低于已预占的 ${sku.lockedWeight} g`)
  }

  sku.stockWeight = after
  sku.version += 1
  sku.updatedAt = new Date().toISOString()
  sku.updatedBy = change.operator

  const ts = new Date().toISOString()
  const log: StockLog = {
    id: nextId(db, 'stockLog'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: change.operator,
    skuId: sku.id,
    productId: sku.productId,
    productName: product?.name ?? '',
    skuCode: sku.skuCode,
    specName: sku.specName,
    type: change.type,
    changeWeight: delta,
    beforeWeight: before,
    afterWeight: after,
    refNo: change.refNo,
    reason: change.reason,
    operator: change.operator,
  }
  db.stockLog.unshift(log)
  return log
}

/** 库存预警列表：可售低于预警克数且 SKU 启用 */
export function stockWarnings(db: DB) {
  return db.productSku
    .filter((s) => !s.deleted && s.status === 1 && compareWeight(s.warnWeight, 0) > 0)
    .filter((s) => compareWeight(availableWeight(s), s.warnWeight) < 0)
    .map((s) => {
      const product = db.product.find((p) => p.id === s.productId)
      return {
        skuId: s.id,
        productId: s.productId,
        productName: product?.name ?? '',
        styleNo: product?.styleNo ?? '',
        skuCode: s.skuCode,
        specName: s.specName,
        stockWeight: s.stockWeight,
        lockedWeight: s.lockedWeight,
        availableWeight: availableWeight(s),
        warnWeight: s.warnWeight,
        level: stockLevelOf(s),
      }
    })
    .sort((a, b) => a.availableWeight - b.availableWeight)
}
