// GET/POST /api/mall/manage/banners — 轮播图列表与新增
import { addLog, handle, ok, readJson } from '@/lib/api'
import { createBanner, listBanners, type BannerInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(listBanners(db))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<BannerInput>(req)
    const created = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const row = createBanner(db, body, actor)
      addLog(db, actor, { module: '轮播图', action: '新增', requestUri: '/api/mall/manage/banners', requestBody: body })
      return row
    })
    return ok(created, '新增成功')
  })
}
