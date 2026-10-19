// POST /api/admin/auth/login — 账号密码 + 图形验证码；连续 5 次失败锁定 15 分钟
import { cookies } from 'next/headers'
import { bad, handle, ok, readJson, requireString } from '@/lib/api'
import { mutate } from '@/lib/store'
import {
  ADMIN_COOKIE, LOCK_DURATION_MS, MAX_FAIL_COUNT, SESSION_TTL_MS, createToken, verifyPassword,
} from '@/lib/auth'
import { CAPTCHA_COOKIE, verifyCaptcha } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

interface Body {
  username?: string
  password?: string
  captcha?: string
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<Body>(req)
    const username = requireString(body.username, '用户名', 50)
    const password = requireString(body.password, '密码', 100)

    const sealed = cookies().get(CAPTCHA_COOKIE)?.value
    if (!verifyCaptcha(body.captcha, sealed)) {
      throw bad('验证码错误或已过期')
    }

    const token = await mutate((db) => {
      const admin = db.sysAdmin.find((a) => !a.deleted && a.username === username)
      if (!admin) throw bad('用户名或密码错误')

      if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
        const minutes = Math.ceil((admin.lockedUntil - Date.now()) / 60_000)
        throw bad(`账号已锁定，请 ${minutes} 分钟后重试`)
      }
      if (admin.status !== 1) throw bad('账号已被禁用，请联系超级管理员')

      if (!verifyPassword(password, admin.password)) {
        admin.failCount = (admin.failCount ?? 0) + 1
        if (admin.failCount >= MAX_FAIL_COUNT) {
          admin.lockedUntil = Date.now() + LOCK_DURATION_MS
          admin.failCount = 0
          throw bad(`连续 ${MAX_FAIL_COUNT} 次失败，账号已锁定 15 分钟`)
        }
        throw bad(`用户名或密码错误，还可重试 ${MAX_FAIL_COUNT - admin.failCount} 次`)
      }

      admin.failCount = 0
      admin.lockedUntil = undefined
      admin.lastLoginAt = new Date().toISOString()

      return createToken({
        id: admin.id,
        username: admin.username,
        realName: admin.realName,
        roleCode: admin.roleCode,
      })
    })

    const res = ok({ token })
    res.headers.append(
      'Set-Cookie',
      `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`,
    )
    // 验证码一次性使用
    res.headers.append('Set-Cookie', `${CAPTCHA_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
    return res
  })
}