import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stockLogsCsv, stockLogsFilename } from '../lib/stock-logs'
import type { StockLog } from '../lib/types'

const row = (over: Partial<StockLog> = {}): StockLog => ({
  id: 1, createdAt: '2026-01-02T03:04:05.000Z', updatedAt: '', skuId: 1, productId: 1,
  productName: '古法"手链"', skuCode: 'WG1-01', specName: '单件', type: 'IN',
  changeWeight: 10, beforeWeight: 0, afterWeight: 10, refNo: undefined, reason: undefined, operator: '张三',
  ...over,
} as unknown as StockLog)

test('stockLogsCsv：BOM、中文表头、双引号转义', () => {
  const csv = stockLogsCsv([row()])
  assert.ok(csv.startsWith('﻿"时间","商品名称"'))
  assert.ok(csv.includes('"古法""手链"""'))
  assert.ok(csv.includes('"10.000","0.000","10.000"'))
  const lines = csv.split('\r\n')
  assert.equal(lines.length, 2)
})

test('stockLogsCsv：无数据只有表头', () => {
  assert.equal(stockLogsCsv([]).split('\r\n').length, 1)
})

test('stockLogsFilename：stock-logs-日期.csv', () => {
  assert.match(stockLogsFilename(), /^stock-logs-\d{4}-\d{2}-\d{2}\.csv$/)
})
