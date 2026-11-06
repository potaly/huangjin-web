// GET /api/mall/manage/users/{id}；PUT 仅老板
import { forbidden, handle, notFound, ok, readJson, requireId } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { listUsers, updateUser, userView, type UserInput } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const user = listUsers(db, actor).find((u) => u.id === id)
    if (!user) throw actor.role === 'OWNER' ? notFound('用户不存在') : forbidden()
    return ok(userView(db, user))
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const input = await readJson<UserInput>(req)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER'])
      return userView(db, updateUser(db, actor, id, input))
    })
    return ok(view, '已保存')
  })
}
