// GET /api/mall/categories — 分类树
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { categoryTree } from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    return ok(categoryTree(db))
  })
}
