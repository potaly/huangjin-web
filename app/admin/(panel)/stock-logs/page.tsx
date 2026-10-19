'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, errMsg, qs } from '@/lib/client'
import { ErrorBox, Button, Tag } from '@/components/ui'
import {
  Field, FilterBar, PageTitle, Pager, Table, Td, inputCls, selectCls, useDebounced,
} from '@/components/admin/AdminUI'
import { fmtWeight, fmtDateTime } from '@/lib/format'
import { STOCK_LOG_TYPE_LABEL, type StockLog, type StockLogType } from '@/lib/types'

const TYPES: StockLogType[] = ['IN', 'OUT', 'ADJUST']

export default function StockLogPage() {
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword)
  const [type, setType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const [rows, setRows] = useState<StockLog[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const query = { keyword: debounced, type, startDate, endDate }

  const load = useCallback(() => {
    setError('')
    setRows(null)
    api
      .get<{ records: StockLog[]; total: number }>(
        `/api/admin/stock-logs${qs({ keyword: debounced, type, startDate, endDate, pageNum, pageSize: 15 })}`,
      )
      .then((res) => {
        setRows(res.records)
        setTotal(res.total)
      })
      .catch((e) => setError(errMsg(e)))
  }, [debounced, type, startDate, endDate, pageNum])

  useEffect(load, [load])
  useEffect(() => setPageNum(1), [debounced, type, startDate, endDate])

  return (
    <div>
      <PageTitle
        title="库存流水"
        desc="每次库存变化都会留痕，记录变动克数与变动前后克数"
        actions={
          <a href={`/api/admin/stock-logs/export${qs(query)}`} download>
            <Button variant="outline">导出 Excel (CSV)</Button>
          </a>
        }
      />

      <FilterBar>
        <Field label="关键词" className="w-56">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="商品名 / SKU / 单据号 / 原因" className={inputCls} />
        </Field>
        <Field label="类型" className="w-32">
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="">全部类型</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{STOCK_LOG_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="开始日期" className="w-40">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="结束日期" className="w-40">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        </Field>
      </FilterBar>

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'time', label: '时间', width: '140px' },
          { key: 'product', label: '商品 / 规格' },
          { key: 'type', label: '类型', width: '90px' },
          { key: 'change', label: '变动 (g)', align: 'right', width: '110px' },
          { key: 'before', label: '变动前 (g)', align: 'right', width: '110px' },
          { key: 'after', label: '变动后 (g)', align: 'right', width: '110px' },
          { key: 'ref', label: '单据号 / 原因', width: '200px' },
          { key: 'operator', label: '操作人', width: '100px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((log) => (
          <tr key={log.id} className="hover:bg-neutral-50/60">
            <Td className="whitespace-nowrap text-[12px] text-neutral-500">{fmtDateTime(log.createdAt)}</Td>
            <Td>
              <p className="line-clamp-1 text-neutral-800">{log.productName}</p>
              <p className="mt-0.5 text-[11.5px] text-neutral-400">{log.specName} · {log.skuCode}</p>
            </Td>
            <Td>
              <Tag tone={log.changeWeight > 0 ? 'green' : log.type === 'ADJUST' ? 'blue' : 'red'}>
                {STOCK_LOG_TYPE_LABEL[log.type] ?? log.type}
              </Tag>
            </Td>
            <Td align="right" className={`tabular-nums font-medium ${log.changeWeight > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {log.changeWeight > 0 ? '+' : ''}{fmtWeight(log.changeWeight)}
            </Td>
            <Td align="right" className="tabular-nums text-neutral-400">{fmtWeight(log.beforeWeight)}</Td>
            <Td align="right" className="tabular-nums text-neutral-800">{fmtWeight(log.afterWeight)}</Td>
            <Td className="text-[12px] text-neutral-500">
              {log.refNo && <p className="text-neutral-700">{log.refNo}</p>}
              <p className="line-clamp-1">{log.reason}</p>
            </Td>
            <Td className="text-[12.5px] text-neutral-500">{log.operator}</Td>
          </tr>
        ))}
      </Table>

      <Pager pageNum={pageNum} pageSize={15} total={total} onChange={setPageNum} />
    </div>
  )
}
