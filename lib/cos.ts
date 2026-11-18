// ────────────────────────────────────────────────────────────────
// 腾讯云 COS（对象存储）最小客户端
//
// 只用到「PUT 上传对象」一个接口，直接按 COS 的 XML API 签名规则
// 自己算 Authorization（q-sign-algorithm=sha1），不引入官方 SDK。
// 签名规则：https://cloud.tencent.com/document/product/436/7778
//
// 密钥只从环境变量读取，不写进代码：
//   TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY   子账号密钥（只授权 huangjin/* 前缀）
//   TENCENT_COS_BUCKET   例如 huangjin-1259254304
//   TENCENT_COS_REGION   例如 ap-guangzhou
//   TENCENT_COS_PUBLIC_URL  可选，图片对外访问域名（默认桶的默认域名；接 CDN 时改这里）
//   TENCENT_COS_PREFIX      可选，对象 key 前缀，默认 huangjin/
// ────────────────────────────────────────────────────────────────

import crypto from 'crypto'

export interface CosConfig {
  secretId: string
  secretKey: string
  bucket: string
  region: string
  /** 对外访问域名，不带结尾斜杠 */
  publicUrl: string
  /** key 前缀，以 / 结尾，例如 huangjin/ */
  prefix: string
}

/** 读取环境变量；四个必填项缺任何一个都返回 null（视为未启用 COS） */
export function cosConfig(env: NodeJS.ProcessEnv = process.env): CosConfig | null {
  const secretId = env.TENCENT_COS_SECRET_ID?.trim() ?? ''
  const secretKey = env.TENCENT_COS_SECRET_KEY?.trim() ?? ''
  const bucket = env.TENCENT_COS_BUCKET?.trim() ?? ''
  const region = env.TENCENT_COS_REGION?.trim() ?? ''
  if (!secretId || !secretKey || !bucket || !region) return null

  const publicUrl = (env.TENCENT_COS_PUBLIC_URL?.trim() || `https://${bucket}.cos.${region}.myqcloud.com`).replace(
    /\/+$/,
    '',
  )
  let prefix = (env.TENCENT_COS_PREFIX?.trim() || 'huangjin/').replace(/^\/+/, '')
  if (!prefix.endsWith('/')) prefix += '/'
  return { secretId, secretKey, bucket, region, publicUrl, prefix }
}

/** COS 要求的 URL 编码：在 encodeURIComponent 基础上再编码 !'()* */
function cosEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

const hmacSha1 = (key: string, data: string) => crypto.createHmac('sha1', key).update(data).digest('hex')
const sha1 = (data: string) => crypto.createHash('sha1').update(data).digest('hex')

function canonical(map: Record<string, string>): { list: string; str: string } {
  const entries = Object.entries(map)
    .map(([k, v]) => [cosEncode(k.toLowerCase()), cosEncode(String(v))] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return {
    list: entries.map(([k]) => k).join(';'),
    str: entries.map(([k, v]) => `${k}=${v}`).join('&'),
  }
}

/** 计算请求签名（Authorization 头的值） */
export function cosAuthorization(input: {
  secretId: string
  secretKey: string
  method: string
  /** 请求路径，例如 /huangjin/a.jpg（未编码形式） */
  pathname: string
  headers?: Record<string, string>
  query?: Record<string, string>
  /** 签名开始时间（秒），默认当前时间 */
  start?: number
  /** 有效期（秒），默认 600 */
  expires?: number
}): string {
  const start = input.start ?? Math.floor(Date.now() / 1000) - 60
  const keyTime = `${start};${start + (input.expires ?? 600)}`
  const signKey = hmacSha1(input.secretKey, keyTime)
  const h = canonical(input.headers ?? {})
  const q = canonical(input.query ?? {})
  const httpString = `${input.method.toLowerCase()}\n${input.pathname}\n${q.str}\n${h.str}\n`
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`
  const signature = hmacSha1(signKey, stringToSign)
  return [
    'q-sign-algorithm=sha1',
    `q-ak=${input.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${h.list}`,
    `q-url-param-list=${q.list}`,
    `q-signature=${signature}`,
  ].join('&')
}

/** key 只允许安全字符，避免路径编码和签名不一致 */
const SAFE_KEY = /^[A-Za-z0-9/_.-]+$/

/** 上传一个对象，返回公开访问地址 */
export async function cosPutObject(
  cfg: CosConfig,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (!key.startsWith(cfg.prefix)) throw new Error(`COS key 必须以 ${cfg.prefix} 开头`)
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('COS key 含非法字符')

  const host = `${cfg.bucket}.cos.${cfg.region}.myqcloud.com`
  const pathname = '/' + key
  const signed = { host, 'content-type': contentType }
  const authorization = cosAuthorization({
    secretId: cfg.secretId,
    secretKey: cfg.secretKey,
    method: 'PUT',
    pathname,
    headers: signed,
  })

  const res = await fetch(`https://${host}${pathname}`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      // key 带随机串或旧图 id，内容不会变，浏览器 / 小程序可长期缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1]
    throw new Error(`上传到 COS 失败（HTTP ${res.status}${code ? ' ' + code : ''}）`)
  }
  return `${cfg.publicUrl}/${key}`
}
