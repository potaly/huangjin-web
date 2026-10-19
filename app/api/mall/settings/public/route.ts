// GET /api/mall/settings/public — 客服信息与库存展示方式
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { publicSettings } from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    return ok(publicSettings(db))
  })
}
