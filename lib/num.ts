// ────────────────────────────────────────────────────────────────
// 克重 / 金额的定点数处理
//
// 需求文档 §8.3 要求后端禁止用 double/float 直接累加金额与克重。
// JS 没有 BigDecimal，这里统一走「整数分 / 整数毫克」的定点运算：
//   · 克重保留 3 位小数 → 放大 1000 倍后用整数累加
//   · 金额保留 2 位小数 → 放大 100 倍后用整数累加
// 对外仍以 number 暴露，但所有加减与四舍五入都经过这里。
// ────────────────────────────────────────────────────────────────

export const WEIGHT_SCALE = 1000
export const AMOUNT_SCALE = 100

function roundHalfUp(value: number): number {
  // Math.round 对负数是「向上取整」，这里统一为 HALF_UP（远离零）
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** 克重 → 整数毫克 */
export function toMg(weight: number): number {
  return roundHalfUp(weight * WEIGHT_SCALE)
}

/** 整数毫克 → 克重（3 位小数） */
export function fromMg(mg: number): number {
  return Number((mg / WEIGHT_SCALE).toFixed(3))
}

/** 克重四舍五入到 3 位小数 */
export function roundWeight(weight: number): number {
  return fromMg(toMg(weight))
}

/** 克重求和，避免浮点累积误差 */
export function sumWeight(values: Array<number | null | undefined>): number {
  return fromMg(values.reduce<number>((acc, v) => acc + toMg(v ?? 0), 0))
}

/** 克重加减：a + b（b 可为负） */
export function addWeight(a: number, b: number): number {
  return fromMg(toMg(a) + toMg(b))
}

/** 金额四舍五入到 2 位小数（HALF_UP） */
export function roundAmount(amount: number): number {
  return Number((roundHalfUp(amount * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(2))
}

/** 克重比较：返回 -1 / 0 / 1，禁止直接用 === 比较 */
export function compareWeight(a: number, b: number): -1 | 0 | 1 {
  const x = toMg(a)
  const y = toMg(b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** 解析用户输入的克重，非法返回 null */
export function parseWeight(input: unknown): number | null {
  if (input === '' || input === null || input === undefined) return null
  const n = typeof input === 'number' ? input : Number(String(input).trim())
  if (!Number.isFinite(n)) return null
  return roundWeight(n)
}

/** 千分位格式化克重，如 1,250.360 */
export function formatWeight(weight: number): string {
  return roundWeight(weight).toLocaleString('zh-CN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}
