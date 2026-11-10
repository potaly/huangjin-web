import test from 'node:test'
import assert from 'node:assert/strict'
import { demoLaborFee } from '../lib/demo-labor-fee'

// 期望值取自线上已用旧脚本 backfill-labor-fee.ts 写入的结果，保证规则抽出后不变
test('演示工费与旧回填脚本结果一致', () => {
  assert.equal(demoLaborFee({ category: '素圈戒指', styleNo: 'WG205', name: '蕾丝花边戒指', weight: 4 }), 27)
  assert.equal(demoLaborFee({ category: '镶嵌项链', styleNo: 'WG206', name: '爆闪碎碎冰星星项链', weight: 8.2 }), 53)
  assert.equal(demoLaborFee({ category: '古法点钻吊坠', styleNo: 'WG214', name: '绿松石炸珠墩墩象吊坠', weight: 8.25 }), 88)
})

test('同一款号结果稳定，未知分类用默认区间', () => {
  const a = demoLaborFee({ category: '不存在', styleNo: 'WG999', name: 'x', weight: 10 })
  assert.equal(a, demoLaborFee({ category: '不存在', styleNo: 'WG999', name: 'x', weight: 10 }))
  assert.ok(a >= 20 && a <= 40)
})
