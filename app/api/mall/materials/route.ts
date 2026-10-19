// GET /api/mall/materials — 启用材质，供商品列表筛选
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const records = db.goldMaterial
      .filter((m) => !m.deleted && m.status === 1)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((m) => ({ id: m.id, code: m.code, name: m.name, purity: m.purity ?? '' }))
    return ok(records)
  })
}
