// POST /api/mall/auth/wx-login { code } — 已绑定则直接登录，否则返回绑定凭证让前端走手机号
import { bad, handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { code2session } from '@/lib/wechat'
import { createBindTicket, createMallToken } from '@/lib/mall-token'
import { loginByOpenid, userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const { code } = await readJson<{ code?: string }>(req)
    if (!code) throw bad('缺少登录 code')
    const openid = await code2session(code)
    if (!openid) return ok({ needPhone: true, bindTicket: null })

    const db = await loadDB()
    const bound = db.mallUser.some((u) => !u.deleted && u.status === 1 && u.openid === openid)
    if (!bound) return ok({ needPhone: true, bindTicket: createBindTicket(openid) })

    const result = await mutate((d) => {
      const user = loginByOpenid(d, openid)
      return user ? { token: createMallToken(user.id, user.role), user: userView(d, user) } : null
    })
    return ok(result ?? { needPhone: true, bindTicket: createBindTicket(openid) })
  })
}
