// GET /api/health — 健康检查与存储驱动自检
import { loadDB, storageDriver } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  try {
    const db = await loadDB()
    return Response.json({
      status: 'ok',
      storage: storageDriver(),
      schemaVersion: db.schemaVersion,
      counts: {
        product: db.product.filter((p) => !p.deleted).length,
        productOnSale: db.product.filter((p) => !p.deleted && p.status === 1).length,
        sku: db.productSku.filter((s) => !s.deleted).length,
        notice: db.notice.filter((n) => !n.deleted).length,
        banner: db.banner.filter((b) => !b.deleted).length,
        stockLog: db.stockLog.length,
      },
      costMs: Date.now() - started,
      time: new Date().toISOString(),
    })
  } catch (e) {
    return Response.json(
      {
        status: 'error',
        storage: storageDriver(),
        message: e instanceof Error ? e.message : String(e),
        costMs: Date.now() - started,
      },
      { status: 500 },
    )
  }
}
