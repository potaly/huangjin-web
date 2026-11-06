// HMAC-SHA256 签名令牌：<base64url(JSON载荷)>.<base64url(签名)>
// purpose 参与签名，用于隔离后台会话、前台会话、微信绑定凭证，防止互相冒用。
// 后台会话 purpose 为空串，与历史令牌格式兼容。

import crypto from 'crypto'

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    // 仅用于未配置密钥的本地 / 预览环境，生产必须设置 ADMIN_SESSION_SECRET
    'huangjin-dev-insecure-secret'
  )
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function mac(body: string, purpose: string): string {
  const input = purpose ? `${purpose}.${body}` : body
  return b64url(crypto.createHmac('sha256', secret()).update(input).digest())
}

export function signToken<T extends { exp: number }>(payload: T, purpose = ''): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${body}.${mac(body, purpose)}`
}

export function verifyToken<T extends { exp: number }>(
  token: string | undefined | null,
  purpose = '',
): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(mac(body, purpose))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as T
    if (!payload?.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
