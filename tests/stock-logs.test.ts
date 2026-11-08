import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterLogs, stockLogsCsv, stockLogsFilename } from '../lib/stock-logs'
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

test('stockLogsCsv：文本列危险开头加单引号，数字列不加', () => {
  const csv = stockLogsCsv([row({
    productName: '=SUM(1)', skuCode: '+A', specName: '-B', refNo: '@C', reason: '\tD', operator: '\rE',
    changeWeight: -1, beforeWeight: 0, afterWeight: -1,
  })])
  const line = csv.split('\r\n')[1]
  assert.ok(line.includes('"\'=SUM(1)","\'+A","\'-B"'))
  assert.ok(line.includes('"\'@C","\'\tD","\'\rE"'))
  assert.ok(line.includes('"-1.000","0.000","-1.000"'))
})

test('stockLogsCsv：时间固定为上海时间', () => {
  const csv = stockLogsCsv([row({ createdAt: '2026-11-07T16:30:00.000Z' })])
  const expected = new Date('2026-11-07T16:30:00.000Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  assert.ok(csv.includes(`"${expected}"`))
  assert.ok(expected.includes('2026/11/8'))
  assert.ok(expected.includes('00:30:00'))
})

test('filterLogs：日期按上海时间，UTC 11-07 16:30 属于上海 11-08', () => {
  const logs = [row({ id: 1, createdAt: '2026-11-07T16:30:00.000Z' })]
  const hit = filterLogs(logs, new URL('http://x/y?startDate=2026-11-08&endDate=2026-11-08'))
  assert.equal(hit.length, 1)
  assert.equal(filterLogs(logs, new URL('http://x/y?startDate=2026-11-07&endDate=2026-11-07')).length, 0)
})
