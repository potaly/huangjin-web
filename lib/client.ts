// ────────────────────────────────────────────────────────────────
// 前端请求封装：统一解包 {code, msg, data}
// ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  code: number
  constructor(msg: string, code: number) {
    super(msg)
    this.code = code
  }
}

interface Envelope<T> {
  code: number
  msg: string
  data: T | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init?.headers,
    },
  })

  let body: Envelope<T>
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError(`服务异常（HTTP ${res.status}）`, res.status)
  }

  if (body.code !== 0) throw new ApiError(body.msg || '请求失败', body.code)
  return body.data as T
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PUT', body: data === undefined ? undefined : JSON.stringify(data) }),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  upload: <T>(url: string, form: FormData) => request<T>(url, { method: 'POST', body: form }),
}

/** 构造查询串，自动忽略空值 */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return '操作失败，请重试'
}
