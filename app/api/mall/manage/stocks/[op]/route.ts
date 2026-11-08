// POST /api/mall/manage/stocks/{in|out|adjust} — 入库 / 出库 / 盘点
import { addLog, handle, notFound, ok, readJson } from '@/lib/api'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { mutate } from '@/lib/store'
import { parseStockOp, runStockOp, STOCK_OP_LABEL, type StockOpBody, type StockOpType } from '@/lib/stock-ops'

export const dynamic = 'force-dynamic'

const OP_TYPES: Record<string, StockOpType> = { in: 'IN', out: 'OUT', adjust: 'ADJUST' }

export async function POST(req: Request, { params }: { params: { op: string } }) {
  return handle(async () => {
    const type = OP_TYPES[params.op]
    if (!type) throw notFound('不支持的库存操作')
    const input = parseStockOp(type, await readJson<StockOpBody>(req))

    const log = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const result = runStockOp(db, type, input, actor.realName)
      addLog(db, actor, {
        module: '库存', action: STOCK_OP_LABEL[type],
        requestUri: `/api/mall/manage/stocks/${params.op}`,
        requestBody: { skuId: input.skuId, weight: input.weight, reason: input.reason },
      })
      return result
    })

    return ok(log, `${STOCK_OP_LABEL[type]}成功：${log.beforeWeight} g → ${log.afterWeight} g`)
  })
}
