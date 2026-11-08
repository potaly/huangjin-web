// 入库 / 出库 / 盘点调整的共用处理（§5「库存管理」：单位克，必填原因）
import { NextResponse } from 'next/server'
import { addLog, handle, ok, readJson, requireAdmin } from './api'
import { mutate } from './store'
import { parseStockOp, runStockOp, STOCK_OP_LABEL, type StockOpBody, type StockOpType } from './stock-ops'

export function stockOpHandler(type: StockOpType) {
  return (req: Request): Promise<NextResponse> =>
    handle(async () => {
      const session = requireAdmin('stock')
      const input = parseStockOp(type, await readJson<StockOpBody>(req))
      const operator = session.realName || session.username

      const log = await mutate((db) => {
        const result = runStockOp(db, type, input, operator)
        addLog(db, session, {
          module: '库存', action: STOCK_OP_LABEL[type],
          requestUri: `/api/admin/stocks/${type.toLowerCase()}`,
          requestBody: { skuId: input.skuId, weight: input.weight, reason: input.reason },
        })
        return result
      })

      return ok(log, `${STOCK_OP_LABEL[type]}成功：${log.beforeWeight} g → ${log.afterWeight} g`)
    })
}
