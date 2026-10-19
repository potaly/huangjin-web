// GET /api/admin/stocks — SKU 库存总览（总克数 / 预占 / 可售）
import { handle, ok, pageParams, paginate, requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { availableWeight, stockLevelOf } from '@/lib/stock'
import { sumWeight } from '@/lib/num'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('stock')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)

    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const materialId = Number(url.searchParams.get('materialId') ?? 0) || 0
    const onlyWarn = url.searchParams.get('onlyWarn') === '1'

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
    if (materialId) rows = rows.filter((r) => r.materialId === materialId)
    if (onlyWarn) rows = rows.filter((r) => r.level !== 'ENOUGH')

    rows.sort((a, b) => a.productId - b.productId || a.id - b.id)
    const page = paginate(rows, pageNum, pageSize)

    return ok({
      ...page,
      summary: {
        skuCount: rows.length,
        stockWeight: sumWeight(rows.map((r) => r.stockWeight)),
        lockedWeight: sumWeight(rows.map((r) => r.lockedWeight)),
        availableWeight: sumWeight(rows.map((r) => r.availableWeight)),
        warnCount: rows.filter((r) => r.level !== 'ENOUGH').length,
      },
    })
  })
}
