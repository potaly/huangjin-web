// 入库 / 出库 / 盘点：PC 后台与小程序管理端共用的校验和执行
import { bad, requireId, requireString } from './api'
import { parseWeight } from './num'
import { applyStockChange } from './stock'
import type { DB, StockLog, StockLogType } from './types'

export type StockOpType = Extract<StockLogType, 'IN' | 'OUT' | 'ADJUST'>

export interface StockOpBody {
  skuId?: unknown
  weight?: unknown
  reason?: string
  refNo?: string
}

export interface StockOpInput {
  skuId: number
  weight: number
  reason: string
  refNo?: string
}

export const STOCK_OP_LABEL: Record<StockOpType, string> = { IN: '入库', OUT: '出库', ADJUST: '盘点调整' }

export function parseStockOp(type: StockOpType, body: StockOpBody): StockOpInput {
  const skuId = requireId(body.skuId, 'SKU')
  const reason = requireString(body.reason, '原因', 200)
  const weight = parseWeight(body.weight)
  if (weight == null) throw bad('请填写合法的克重')
  if (type !== 'ADJUST' && weight <= 0) throw bad('克重必须大于 0')
  return { skuId, weight, reason, refNo: body.refNo ? String(body.refNo).slice(0, 50) : undefined }
}

export function runStockOp(db: DB, type: StockOpType, input: StockOpInput, operator: string): StockLog {
  return applyStockChange(db, {
    skuId: input.skuId,
    type,
    ...(type === 'ADJUST'
      ? { targetWeight: input.weight }
      : { changeWeight: type === 'IN' ? input.weight : -input.weight }),
    reason: input.reason,
    refNo: input.refNo,
    operator,
  })
}
