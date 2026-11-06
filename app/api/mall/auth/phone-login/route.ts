// POST /api/mall/auth/phone-login { phone, bindTicket? }
import { headers } from 'next/headers'
import { BizError, bad, handle, ok, readJson } from '@/lib/api'
import { mutate } from '@/lib/store'
import { hitLimit } from '@/lib/rate-limit'
import { createMallToken, parseBindTicket } from '@/lib/mall-token'
import { loginByPhone, userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    if (hitLimit(`phone-login:${ip}`, 10, 60_000)) throw new BizError('尝试太频繁，请一分钟后再试', 429)

    const { phone, bindTicket } = await readJson<{ phone?: string; bindTicket?: string | null }>(req)
    let openid: string | undefined
    if (bindTicket) {
      openid = parseBindTicket(bindTicket) ?? undefined
      if (!openid) throw bad('微信绑定已过期，请重新打开小程序')
    }
    const result = await mutate((db) => {
      const user = loginByPhone(db, String(phone ?? ''), openid)
      return { token: createMallToken(user.id, user.role), user: userView(db, user) }
    })
    return ok(result)
  })
}
