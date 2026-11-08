// GET/POST /api/admin/banners — 首页轮播图
import { addLog, handle, ok, readJson, requireAdmin } from '@/lib/api'
import { createBanner, listBanners, type BannerInput } from '@/lib/content-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('content')
    const db = await loadDB()
    return ok(listBanners(db))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('content')
    const body = await readJson<BannerInput>(req)
    const created = await mutate((db) => {
      const banner = createBanner(db, body, session)
      addLog(db, session, { module: '轮播图', action: '新增', requestUri: '/api/admin/banners', requestBody: body })
      return banner
    })
    return ok(created, '新增成功')
  })
}
