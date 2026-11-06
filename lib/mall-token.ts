// 前台会话令牌（30 天）与微信绑定凭证（10 分钟）
import { signToken, verifyToken } from './sign'
import type { MallRole, MallSession } from './types'

export const MALL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const BIND_TTL_MS = 10 * 60 * 1000

export function createMallToken(uid: number, role: MallRole): string {
  return signToken<MallSession>({ uid, role, exp: Date.now() + MALL_TOKEN_TTL_MS }, 'mall')
}

export function parseMallToken(token: string | undefined | null): MallSession | null {
  return verifyToken<MallSession>(token, 'mall')
}

/** 微信 openid 尚未绑定手机号时签发，手机号登录时凭它完成绑定 */
export function createBindTicket(openid: string): string {
  return signToken({ openid, exp: Date.now() + BIND_TTL_MS }, 'wxbind')
}

export function parseBindTicket(ticket: string | undefined | null): string | null {
  return verifyToken<{ openid: string; exp: number }>(ticket, 'wxbind')?.openid ?? null
}
