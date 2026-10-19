// GET /api/admin/auth/captcha — 图形验证码
import { CAPTCHA_COOKIE, captchaSvg, randomCode, sealCaptcha } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

export async function GET() {
  const code = randomCode(4)
  const svg = captchaSvg(code)
  const res = new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
  res.headers.append(
    'Set-Cookie',
    `${CAPTCHA_COOKIE}=${sealCaptcha(code)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`,
  )
  return res
}
