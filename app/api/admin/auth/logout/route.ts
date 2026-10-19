// POST /api/admin/auth/logout
import { handle, ok } from '@/lib/api'
import { ADMIN_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  return handle(async () => {
    const res = ok(true, '已退出登录')
    res.headers.append('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
    return res
  })
}
