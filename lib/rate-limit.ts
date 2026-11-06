// 单实例内存限流（演示用的尽力限制，Serverless 多实例间不共享）
const buckets = new Map<string, number[]>()

/** 记一次访问；返回 true 表示已超限，应拒绝 */
export function hitLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return true
  }
  recent.push(now)
  buckets.set(key, recent)
  return false
}
