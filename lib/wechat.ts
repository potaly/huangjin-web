// 小程序登录：用 wx.login 的 code 换 openid
// 需要环境变量 WX_APPID / WX_SECRET（在 Vercel 项目设置里配置，不入库）
export function wechatConfigured(): boolean {
  return Boolean(process.env.WX_APPID && process.env.WX_SECRET)
}

/** 成功返回 openid；未配置或微信返回错误时返回 null（前端改走手机号登录） */
export async function code2session(code: string): Promise<string | null> {
  if (!wechatConfigured()) return null
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(process.env.WX_APPID!)}` +
    `&secret=${encodeURIComponent(process.env.WX_SECRET!)}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string }
    if (body.openid) return body.openid
    console.warn('[wechat] jscode2session failed', body.errcode, body.errmsg)
    return null
  } catch (e) {
    console.warn('[wechat] jscode2session error', e)
    return null
  }
}

// ── 订阅消息 ────────────────────────────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null

/** 取接口调用凭据（stable_token，不会挤掉其他地方拿到的 token）；实例内缓存到过期前 5 分钟 */
export async function getAccessToken(force = false): Promise<string | null> {
  if (!wechatConfigured()) return null
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token
  try {
    const res = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: process.env.WX_APPID,
        secret: process.env.WX_SECRET,
      }),
      cache: 'no-store',
    })
    const body = (await res.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
    if (!body.access_token) {
      console.warn('[wechat] stable_token failed', body.errcode, body.errmsg)
      return null
    }
    tokenCache = {
      token: body.access_token,
      expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 7200) - 300) * 1000,
    }
    return tokenCache.token
  } catch (e) {
    console.warn('[wechat] stable_token error', e)
    return null
  }
}

export interface SubscribeMessage {
  touser: string
  template_id: string
  page?: string
  miniprogram_state?: 'developer' | 'trial' | 'formal'
  lang?: string
  data: Record<string, { value: string }>
}

/**
 * 发一条订阅消息。返回微信的 errcode（0 成功；43101 对方没有可用的订阅次数），
 * 未配置或网络异常返回 -1。不抛异常。
 */
export async function sendSubscribeMessage(msg: SubscribeMessage): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(attempt > 0)
    if (!token) return -1
    try {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
          cache: 'no-store',
        },
      )
      const body = (await res.json()) as { errcode?: number; errmsg?: string }
      const code = body.errcode ?? 0
      // token 失效：换新 token 重试一次
      if ((code === 40001 || code === 42001) && attempt === 0) continue
      if (code !== 0) console.warn('[wechat] subscribe send failed', code, body.errmsg)
      return code
    } catch (e) {
      console.warn('[wechat] subscribe send error', e)
      return -1
    }
  }
  return -1
}

// ── 小程序码 ────────────────────────────────────────────────────

/**
 * 生成无数量限制的小程序码（getwxacodeunlimit）。
 * 成功返回 PNG 二进制；失败返回 { errcode, errmsg }。
 *
 * 注意：微信要求 page 必须是「已发布」版本里存在的页面，否则返回 41030。
 * 开发期把 WX_QRCODE_ENV 设成 trial / develop 可跳过该校验。
 */
export async function getUnlimitedQrCode(input: {
  scene: string
  page: string
  width?: number
}): Promise<{ png: Buffer } | { errcode: number; errmsg: string }> {
  const envVersion = (process.env.WX_QRCODE_ENV?.trim() || 'release') as 'develop' | 'trial' | 'release'
  const payload = {
    scene: input.scene,
    page: input.page,
    width: input.width ?? 280,
    // 非正式版时页面尚未发布，必须关掉路径校验，否则必然 41030
    check_path: envVersion === 'release',
    env_version: envVersion,
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(attempt > 0)
    if (!token) return { errcode: -1, errmsg: '微信接口未配置或取 access_token 失败' }
    try {
      const res = await fetch(
        `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        },
      )
      // 成功时微信直接回图片二进制，失败时回 JSON，靠 content-type 区分
      const type = res.headers.get('content-type') ?? ''
      if (type.includes('application/json')) {
        const body = (await res.json()) as { errcode?: number; errmsg?: string }
        const code = body.errcode ?? -1
        if ((code === 40001 || code === 42001) && attempt === 0) continue
        console.warn('[wechat] getwxacodeunlimit failed', code, body.errmsg)
        return { errcode: code, errmsg: body.errmsg ?? '微信返回未知错误' }
      }
      const png = Buffer.from(await res.arrayBuffer())
      if (!png.byteLength) return { errcode: -1, errmsg: '微信返回了空图片' }
      return { png }
    } catch (e) {
      console.warn('[wechat] getwxacodeunlimit error', e)
      return { errcode: -1, errmsg: '请求微信接口失败' }
    }
  }
  return { errcode: -1, errmsg: '取 access_token 失败' }
}
