// GET  /api/mall/manage/users?role=  老板看全部，业务员看自己的客户
// POST /api/mall/manage/users          仅老板
import { handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { createUser, listUsers, userView, type UserInput } from '@/lib/mall-user-service'
import type { MallRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const role = new URL(req.url).searchParams.get('role') as MallRole | null
    const valid = role && ['OWNER', 'SALES', 'CUSTOMER'].includes(role) ? role : undefined
    return ok(listUsers(db, actor, valid).map((u) => userView(db, u)))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson<UserInput>(req)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER'])
      return userView(db, createUser(db, actor, input))
    })
    return ok(view, '已新增')
  })
}
