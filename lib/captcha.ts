// ────────────────────────────────────────────────────────────────
// 后台登录图形验证码（需求文档 §7.2）
// 验证码答案不落库：HMAC 签名后放在 httpOnly Cookie，5 分钟有效
// ────────────────────────────────────────────────────────────────

import crypto from 'crypto'

export const CAPTCHA_COOKIE = 'hj_captcha'
const TTL_MS = 5 * 60 * 1000
const CHARS = '2345678ABCDEFGHJKLMNPQRSTUVWXYZ'

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'huangjin-dev-insecure-secret'
}

export function randomCode(len = 4): string {
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += CHARS[bytes[i] % CHARS.length]
  return out
}

/** 生成放入 Cookie 的凭据：`<expireAt>.<hmac(code+expireAt)>` */
export function sealCaptcha(code: string): string {
  const exp = Date.now() + TTL_MS
  const mac = crypto
    .createHmac('sha256', secret())
    .update(`${code.toUpperCase()}|${exp}`)
    .digest('hex')
  return `${exp}.${mac}`
}

export function verifyCaptcha(input: string | undefined, sealed: string | undefined): boolean {
  if (!input || !sealed) return false
  const [expStr, mac] = sealed.split('.')
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false
  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${input.trim().toUpperCase()}|${exp}`)
    .digest('hex')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** 干扰线 + 字符扭曲的 SVG 验证码 */
export function captchaSvg(code: string): string {
  const w = 120
  const h = 44
  const rand = (min: number, max: number) => min + Math.random() * (max - min)
  const colors = ['#8a631d', '#a8761f', '#6b4f1a', '#9a6b22']

  let noise = ''
  for (let i = 0; i < 4; i++) {
    noise += `<path d="M${rand(0, 20).toFixed(1)} ${rand(4, h - 4).toFixed(1)} Q${rand(30, 90).toFixed(1)} ${rand(0, h).toFixed(1)} ${rand(w - 20, w).toFixed(1)} ${rand(4, h - 4).toFixed(1)}" stroke="${colors[i % colors.length]}" stroke-opacity=".35" fill="none" stroke-width="1.4"/>`
  }
  for (let i = 0; i < 24; i++) {
    noise += `<circle cx="${rand(0, w).toFixed(1)}" cy="${rand(0, h).toFixed(1)}" r="${rand(0.6, 1.6).toFixed(1)}" fill="${colors[i % colors.length]}" fill-opacity=".3"/>`
  }

  const glyphs = code
    .split('')
    .map((ch, i) => {
      const x = 16 + i * 25
      const y = 31 + rand(-3, 3)
      const rot = rand(-18, 18).toFixed(1)
      const size = rand(22, 27).toFixed(1)
      return `<text x="${x}" y="${y.toFixed(1)}" font-size="${size}" font-family="'DejaVu Sans Mono',Menlo,monospace" font-weight="700" fill="${colors[i % colors.length]}" transform="rotate(${rot} ${x} ${y.toFixed(1)})">${ch}</text>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fdf9ed"/>${noise}${glyphs}</svg>`
}
