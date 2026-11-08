// PUT/DELETE /api/mall/manage/banners/{id}
import { addLog, handle, ok, readJson, requireId } from '@/lib/api'
import { deleteBanner, updateBanner, type BannerInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<BannerInput>(req)
    const updated = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const row = updateBanner(db, id, body, actor)
      addLog(db, actor, { module: '轮播图', action: '编辑', requestUri: `/api/mall/manage/banners/${id}`, requestBody: body })
      return row
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      deleteBanner(db, id)
      addLog(db, actor, { module: '轮播图', action: '删除', requestUri: `/api/mall/manage/banners/${id}` })
    })
    return ok(true, '删除成功')
  })
}
