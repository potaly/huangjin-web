'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, errMsg, qs } from '@/lib/client'
import { ErrorBox, Tag } from '@/components/ui'
import {
  Field, FilterBar, PageTitle, Pager, Table, Td, inputCls, selectCls, useDebounced,
} from '@/components/admin/AdminUI'
import { fmtDateTime } from '@/lib/format'
import type { OperationLog } from '@/lib/types'

export default function OperationLogPage() {
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword)
  const [moduleName, setModuleName] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const [rows, setRows] = useState<OperationLog[] | null>(null)
  const [modules, setModules] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    setRows(null)
    api
      .get<{ records: OperationLog[]; total: number; modules: string[] }>(
        `/api/admin/operation-logs${qs({ keyword: debounced, module: moduleName, pageNum, pageSize: 15 })}`,
      )
      .then((res) => {
        setRows(res.records)
        setTotal(res.total)
        setModules(res.modules)
      })
      .catch((e) => setError(errMsg(e)))
  }, [debounced, moduleName, pageNum])

  useEffect(load, [load])
  useEffect(() => setPageNum(1), [debounced, moduleName])

  return (
    <div>
      <PageTitle title="操作日志" desc="记录后台所有写操作，最多保留最近 500 条" />

      <FilterBar>
        <Field label="关键词" className="w-56">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="操作人 / 动作 / 接口" className={inputCls} />
        </Field>
        <Field label="模块" className="w-36">
          <select value={moduleName} onChange={(e) => setModuleName(e.target.value)} className={selectCls}>
            <option value="">全部模块</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      </FilterBar>

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'time', label: '时间', width: '150px' },
          { key: 'admin', label: '操作人', width: '110px' },
          { key: 'module', label: '模块', width: '100px' },
          { key: 'action', label: '动作', width: '110px' },
          { key: 'uri', label: '接口', width: '230px' },
          { key: 'body', label: '请求内容' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((log) => (
          <tr key={log.id} className="hover:bg-neutral-50/60">
            <Td className="whitespace-nowrap text-[12px] text-neutral-500">{fmtDateTime(log.createdAt)}</Td>
            <Td className="text-[12.5px] text-neutral-700">{log.adminName}</Td>
            <Td><Tag tone="blue">{log.module}</Tag></Td>
            <Td className="text-[12.5px] text-neutral-700">{log.action}</Td>
            <Td><code className="text-[11.5px] text-neutral-400">{log.requestUri}</code></Td>
            <Td>
              <code className="line-clamp-2 break-all text-[11.5px] text-neutral-400">
                {log.requestBody || '—'}
              </code>
            </Td>
          </tr>
        ))}
      </Table>

      <Pager pageNum={pageNum} pageSize={15} total={total} onChange={setPageNum} />
    </div>
  )
}
