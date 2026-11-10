// 演示用参考工费（元/克）
//
// ⚠️ 占位数据：按二级分类区间 + 款号哈希生成，同一款号每次结果相同，不是真实工费。
// 真实工费请在后台「商品管理 → 编辑 → 工费（元/克）」里修改。
// 规则与早先的 scripts/backfill-labor-fee.ts 一致，已有商品的工费不会因此变化。

/** 二级分类 → 工费区间（元/克） */
export const DEMO_FEE_RANGE: Record<string, [number, number]> = {
  素金项链: [18, 30], 镶嵌项链: [35, 60], 套链: [22, 38], 古法点钻吊坠: [55, 95], 葫芦吊坠: [40, 70],
  平安扣吊坠: [35, 60], 罗盘吊坠: [60, 100], 貔貅吊坠: [50, 90], 金刚杵吊坠: [55, 95], 小金条吊坠: [20, 35],
  转运珠吊坠: [30, 50], 锁骨链: [20, 35],
  实心手镯: [12, 22], 空心手镯: [25, 40], 金手链: [20, 35], 手串: [30, 50], 链镯: [30, 50],
  手表链: [55, 90], 转运珠手链: [30, 45], 卡扣手链: [20, 32],
  素圈戒指: [20, 35], 镶嵌戒指: [45, 80], 耳钉: [40, 70], 耳线: [35, 60],
  '5G足金系列': [25, 40], 镶嵌彩宝系列: [45, 75], 古法点钻系列: [60, 95],
}
const DEFAULT_RANGE: [number, number] = [20, 40]

/** 款号 → [0,1) 的稳定伪随机数（FNV-1a） */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export function demoLaborFee(input: {
  /** 二级分类名 */
  category: string
  styleNo: string
  name: string
  /** 第一个规格的参考克重 */
  weight: number
}): number {
  const [lo, hi] = DEMO_FEE_RANGE[input.category] ?? DEFAULT_RANGE
  let fee = lo + (hi - lo) * hash01(input.styleNo)
  // 小件按克数摊的工费更高，大件更低
  const w = input.weight
  if (w > 0 && w <= 3) fee *= 1.08
  else if (w > 3 && w <= 6) fee *= 1.04
  else if (w >= 20) fee *= 0.88
  else if (w >= 12) fee *= 0.94
  // 工艺加成
  if (/5D/.test(input.name)) fee *= 1.1
  return Math.round(fee)
}
