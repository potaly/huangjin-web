// PUT/DELETE /api/mall/manage/materials/{id}
import { addLog, handle, ok, readJson, requireId } from '@/lib/api'
import { deleteMaterial, updateMaterial, type MaterialInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<MaterialInput>(req)
    const updated = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const row = updateMaterial(db, id, body, actor)
      addLog(db, actor, { module: '材质', action: '编辑', requestUri: `/api/mall/manage/materials/${id}`, requestBody: body })
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
      deleteMaterial(db, id, actor)
      addLog(db, actor, { module: '材质', action: '删除', requestUri: `/api/mall/manage/materials/${id}` })
    })
    return ok(true, '删除成功')
  })
}
