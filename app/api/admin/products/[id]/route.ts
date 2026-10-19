// GET/PUT/DELETE /api/admin/products/{id}
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { updateProduct, type ProductInput } from '@/lib/product-service'
import { availableWeight, stockLevelOf } from '@/lib/stock'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    requireAdmin('product')
    const db = await loadDB()
    const id = requireId(params.id)
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

    return ok({ ...product, skus })
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('product')
    const id = requireId(params.id)
    const body = await readJson<ProductInput>(req)

    await mutate((db) => {
      const product = updateProduct(db, id, body, session)
      addLog(db, session, {
        module: '商品', action: '编辑', requestUri: `/api/admin/products/${id}`,
        requestBody: { name: product.name, styleNo: product.styleNo },
      })
    })
    return ok(true, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('product')
    const id = requireId(params.id)

    await mutate((db) => {
      const product = db.product.find((p) => p.id === id && !p.deleted)
      if (!product) throw notFound('商品不存在')
      if (product.status === 1) throw bad('请先下架商品再删除')

      const skus = db.productSku.filter((s) => !s.deleted && s.productId === id)
      const withStock = skus.filter((s) => s.stockWeight > 0)
      if (withStock.length > 0) {
        throw bad(`该商品下 ${withStock.length} 个 SKU 仍有库存，请先出库或盘点为 0`)
      }

      product.deleted = true
      product.updatedAt = new Date().toISOString()
      product.updatedBy = session.username
      for (const sku of skus) {
        sku.deleted = true
        sku.updatedAt = product.updatedAt
      }
      addLog(db, session, { module: '商品', action: '删除', requestUri: `/api/admin/products/${id}` })
    })
    return ok(true, '删除成功')
  })
}
