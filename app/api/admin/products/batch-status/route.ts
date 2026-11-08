// PUT /api/admin/products/batch-status — 批量上下架
import { addLog, bad, handle, ok, readJson, requireAdmin, toStatus } from '@/lib/api'
import { batchSetProductStatus } from '@/lib/product-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  return handle(async () => {
    const session = requireAdmin('product')
    const body = await readJson<{ ids?: unknown; status?: unknown }>(req)
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : []
    if (ids.length === 0) throw bad('请先选择商品')
    const status = toStatus(body.status, 0)

    const result = await mutate((db) => {
      const r = batchSetProductStatus(db, ids, status, session)
      addLog(db, session, {
        module: '商品', action: status === 1 ? '批量上架' : '批量下架',
        requestUri: '/api/admin/products/batch-status', requestBody: { ids, status },
      })
      return r
    })

    const msg = result.skipped.length
      ? `成功 ${result.succeeded.length} 个，${result.skipped.length} 个未处理`
      : `成功处理 ${result.succeeded.length} 个商品`
    return ok(result, msg)
  })
}
