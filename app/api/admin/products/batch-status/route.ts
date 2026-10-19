// PUT /api/admin/products/batch-status — 批量上下架
import { addLog, bad, handle, ok, readJson, requireAdmin, toStatus } from '@/lib/api'
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
      const succeeded: number[] = []
      const skipped: Array<{ id: number; name: string; reason: string }> = []

      for (const id of ids) {
        const product = db.product.find((p) => p.id === id && !p.deleted)
        if (!product) {
          skipped.push({ id, name: `#${id}`, reason: '商品不存在' })
          continue
        }
        if (status === 1) {
          if (!product.cover) {
            skipped.push({ id, name: product.name, reason: '缺少主图' })
            continue
          }
          const hasActiveSku = db.productSku.some(
            (s) => !s.deleted && s.productId === id && s.status === 1,
          )
          if (!hasActiveSku) {
            skipped.push({ id, name: product.name, reason: '没有启用的 SKU' })
            continue
          }
        }
        product.status = status
        product.updatedAt = new Date().toISOString()
        product.updatedBy = session.username
        succeeded.push(id)
      }

      addLog(db, session, {
        module: '商品', action: status === 1 ? '批量上架' : '批量下架',
        requestUri: '/api/admin/products/batch-status', requestBody: { ids, status },
      })
      return { succeeded, skipped }
    })

    const msg = result.skipped.length
      ? `成功 ${result.succeeded.length} 个，${result.skipped.length} 个未处理`
      : `成功处理 ${result.succeeded.length} 个商品`
    return ok(result, msg)
  })
}
