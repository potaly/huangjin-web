// POST /api/mall/auth/wx-login { code, switch? } — 已绑定则直接登录，否则返回绑定凭证让前端走手机号
// switch=true（用户主动退出后切换账号）：不自动登录，总是返回绑定凭证
import { bad, handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { code2session } from '@/lib/wechat'
import { createBindTicket, createMallToken } from '@/lib/mall-token'
import { loginByOpenid, userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ code?: string; switch?: boolean }>(req)
    const code = body.code
    if (!code) throw bad('缺少登录 code')
    const openid = await code2session(code)
    if (!openid) return ok({ needPhone: true, bindTicket: null })
    if (body.switch === true) return ok({ needPhone: true, bindTicket: createBindTicket(openid) })

    const db = await loadDB()
    const bound = db.mallUser.find((u) => !u.deleted && u.status === 1 && u.openid === openid)
    if (!bound) return ok({ needPhone: true, bindTicket: createBindTicket(openid) })

    // 一小时内登录过则不重复写库
    const last = bound.lastLoginAt ? Date.parse(bound.lastLoginAt) : 0
    if (last && Date.now() - last < 60 * 60 * 1000) {
      return ok({ token: createMallToken(bound.id, bound.role), user: userView(db, bound) })
    }

    const result = await mutate((d) => {
      const user = loginByOpenid(d, openid)
      return user ? { token: createMallToken(user.id, user.role), user: userView(d, user) } : null
    })
    return ok(result ?? { needPhone: true, bindTicket: createBindTicket(openid) })
  })
}
