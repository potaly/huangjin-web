// 入库 / 出库 / 盘点调整的共用处理（§5「库存管理」：单位克，必填原因）
import { NextResponse } from 'next/server'
import { addLog, bad, handle, ok, readJson, requireAdmin, requireId, requireString } from './api'
import { mutate } from './store'
import { applyStockChange } from './stock'
import { parseWeight } from './num'
import type { StockLogType } from './types'

interface Body {
  skuId?: unknown
  weight?: unknown
  reason?: string
  refNo?: string
}

const ACTION_LABEL: Record<string, string> = { IN: '入库', OUT: '出库', ADJUST: '盘点调整' }

export function stockOpHandler(type: Extract<StockLogType, 'IN' | 'OUT' | 'ADJUST'>) {
  return (req: Request): Promise<NextResponse> =>
    handle(async () => {
      const session = requireAdmin('stock')
      const body = await readJson<Body>(req)
      const skuId = requireId(body.skuId, 'SKU')
      const reason = requireString(body.reason, '原因', 200)
      const weight = parseWeight(body.weight)
      if (weight == null) throw bad('请填写合法的克重')
      if (type !== 'ADJUST' && weight <= 0) throw bad('克重必须大于 0')

      const operator = session.realName || session.username

      const log = await mutate((db) => {
        const result = applyStockChange(db, {
          skuId,
          type,
          ...(type === 'ADJUST'
            ? { targetWeight: weight }
            : { changeWeight: type === 'IN' ? weight : -weight }),
          reason,
          refNo: body.refNo ? String(body.refNo).slice(0, 50) : undefined,
          operator,
        })
        addLog(db, session, {
          module: '库存', action: ACTION_LABEL[type],
          requestUri: `/api/admin/stocks/${type.toLowerCase()}`,
          requestBody: { skuId, weight, reason },
        })
        return result
      })

      return ok(log, `${ACTION_LABEL[type]}成功：${log.beforeWeight} g → ${log.afterWeight} g`)
    })
}
