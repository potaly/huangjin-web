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
