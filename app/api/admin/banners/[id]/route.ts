// PUT/DELETE /api/admin/banners/{id}
import { addLog, handle, ok, readJson, requireAdmin, requireId } from '@/lib/api'
import { deleteBanner, updateBanner, type BannerInput } from '@/lib/content-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    const body = await readJson<BannerInput>(req)
    const updated = await mutate((db) => {
      const banner = updateBanner(db, id, body, session)
      addLog(db, session, { module: '轮播图', action: '编辑', requestUri: `/api/admin/banners/${id}`, requestBody: body })
      return banner
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('content')
    const id = requireId(params.id)
    await mutate((db) => {
      deleteBanner(db, id)
      addLog(db, session, { module: '轮播图', action: '删除', requestUri: `/api/admin/banners/${id}` })
    })
    return ok(true, '删除成功')
  })
}
