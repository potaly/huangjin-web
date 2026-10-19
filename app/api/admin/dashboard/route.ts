// GET /api/admin/dashboard — 统计卡片与库存预警
import { handle, ok, requireAdmin } from '@/lib/api'
import { loadDB, storageDriver } from '@/lib/store'
import { availableWeight, stockWarnings } from '@/lib/stock'
import { visibleNotices } from '@/lib/mall'
import { sumWeight } from '@/lib/num'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('dashboard')
    const db = await loadDB()

    const products = db.product.filter((p) => !p.deleted)
    const skus = db.productSku.filter((s) => !s.deleted)

    const byMaterial = db.goldMaterial
      .filter((m) => !m.deleted)
      .map((m) => {
        const productIds = products.filter((p) => p.materialId === m.id).map((p) => p.id)
        const rows = skus.filter((s) => productIds.includes(s.productId))
        return {
          materialId: m.id,
          code: m.code,
          name: m.name,
          status: m.status,
          productCount: productIds.length,
          skuCount: rows.length,
          stockWeight: sumWeight(rows.map((s) => s.stockWeight)),
          availableWeight: sumWeight(rows.map((s) => availableWeight(s))),
        }
      })
      .sort((a, b) => b.stockWeight - a.stockWeight)

    const warnings = stockWarnings(db)

    return ok({
      productTotal: products.length,
      productOnSale: products.filter((p) => p.status === 1).length,
      productOffSale: products.filter((p) => p.status === 0).length,
      skuTotal: skus.length,
      stockWeightTotal: sumWeight(skus.map((s) => s.stockWeight)),
      availableWeightTotal: sumWeight(skus.map((s) => availableWeight(s))),
      categoryTotal: db.category.filter((c) => !c.deleted).length,
      noticeVisible: visibleNotices(db).length,
      bannerActive: db.banner.filter((b) => !b.deleted && b.status === 1).length,
      byMaterial,
      warnCount: warnings.length,
      warnings: warnings.slice(0, 10),
      recentLogs: db.stockLog.slice(0, 8),
      storageDriver: storageDriver(),
      // 二期：此处补充今日金价提醒、订单与销售统计
    })
  })
}
