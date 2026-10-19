'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { api, errMsg, qs } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, StockBadge } from '@/components/ui'
import {
  Card, Field, FilterBar, Modal, PageTitle, Pager, Table, Td, inputCls, selectCls, useDebounced,
} from '@/components/admin/AdminUI'
import { fmtWeight } from '@/lib/format'
import type { Material, StockLevel } from '@/lib/types'

interface Row {
  id: number
  productId: number
  productName: string
  styleNo: string
  cover: string
  productStatus: 0 | 1
  materialName: string
  skuCode: string
  specName: string
  refWeight: number | null
  refQty: number | null
  stockWeight: number
  lockedWeight: number
  availableWeight: number
  warnWeight: number
  status: 0 | 1
  level: StockLevel
}

interface Summary {
  skuCount: number
  stockWeight: number
  lockedWeight: number
  availableWeight: number
  warnCount: number
}

type OpType = 'in' | 'out' | 'adjust'

const OP_LABEL: Record<OpType, string> = { in: '入库', out: '出库', adjust: '盘点调整' }

export default function StockPage() {
  return (
    <Suspense fallback={<PageTitle title="库存管理" />}>
      <StockList />
    </Suspense>
  )
}

function StockList() {
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword)
  const [materialId, setMaterialId] = useState(0)
  const [onlyWarn, setOnlyWarn] = useState(searchParams.get('onlyWarn') === '1')
  const [pageNum, setPageNum] = useState(1)

  const [rows, setRows] = useState<Row[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [materials, setMaterials] = useState<Material[]>([])

  const [op, setOp] = useState<{ type: OpType; row: Row } | null>(null)

  useEffect(() => {
    api.get<Material[]>('/api/admin/materials').then(setMaterials).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setError('')
    setRows(null)
    api
      .get<{ records: Row[]; total: number; summary: Summary }>(
        `/api/admin/stocks${qs({ keyword: debounced, materialId: materialId || '', onlyWarn: onlyWarn ? 1 : '', pageNum, pageSize: 10 })}`,
      )
      .then((res) => {
        setRows(res.records)
        setTotal(res.total)
        setSummary(res.summary)
      })
      .catch((e) => setError(errMsg(e)))
  }, [debounced, materialId, onlyWarn, pageNum])

  useEffect(load, [load])
  useEffect(() => setPageNum(1), [debounced, materialId, onlyWarn])

  return (
    <div>
      <PageTitle
        title="库存管理"
        desc="库存以 SKU 为单位、单位克，保留 3 位小数；可售 = 总库存 − 预占"
        actions={
          <Link href="/admin/stock-logs">
            <Button variant="outline">库存流水</Button>
          </Link>
        }
      />

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><p className="text-[12.5px] text-neutral-500">SKU 数</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{summary.skuCount}</p></Card>
          <Card><p className="text-[12.5px] text-neutral-500">总库存 (g)</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{fmtWeight(summary.stockWeight)}</p></Card>
          <Card><p className="text-[12.5px] text-neutral-500">可售 (g)</p><p className="mt-1 text-[22px] font-semibold tabular-nums text-gold-700">{fmtWeight(summary.availableWeight)}</p></Card>
          <Card><p className="text-[12.5px] text-neutral-500">预警 SKU</p><p className={`mt-1 text-[22px] font-semibold tabular-nums ${summary.warnCount ? 'text-amber-600' : ''}`}>{summary.warnCount}</p></Card>
        </div>
      )}

      <FilterBar>
        <Field label="关键词" className="w-56">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="商品名 / 款号 / SKU 编码" className={inputCls} />
        </Field>
        <Field label="材质" className="w-36">
          <select value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))} className={selectCls}>
            <option value={0}>全部材质</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <label className="mb-1 flex items-center gap-1.5 text-[13px] text-neutral-600">
          <input type="checkbox" checked={onlyWarn} onChange={(e) => setOnlyWarn(e.target.checked)} className="h-3.5 w-3.5 accent-gold-500" />
          只看预警 / 售罄
        </label>
      </FilterBar>

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'product', label: '商品 / 规格' },
          { key: 'material', label: '材质', width: '110px' },
          { key: 'ref', label: '参考', width: '130px' },
          { key: 'stock', label: '总库存 (g)', align: 'right', width: '110px' },
          { key: 'locked', label: '预占 (g)', align: 'right', width: '90px' },
          { key: 'avail', label: '可售 (g)', align: 'right', width: '110px' },
          { key: 'warn', label: '预警 (g)', align: 'right', width: '100px' },
          { key: 'ops', label: '操作', align: 'right', width: '170px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((row) => (
          <tr key={row.id} className="hover:bg-neutral-50/60">
            <Td>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.cover || '/img/placeholder.svg'} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-neutral-100" />
                <div className="min-w-0">
                  <p className="line-clamp-1 font-medium text-neutral-800">{row.productName}</p>
                  <p className="mt-0.5 text-[11.5px] text-neutral-400">
                    {row.specName} · {row.skuCode}
                    {row.productStatus === 0 && <span className="ml-1.5 text-rose-500">商品已下架</span>}
                  </p>
                </div>
              </div>
            </Td>
            <Td className="text-[12.5px] text-neutral-500">{row.materialName}</Td>
            <Td className="text-[12px] text-neutral-400">
              {row.refWeight ? `${row.refWeight} g/件` : '—'}
              {row.refQty ? <><br />约 {row.refQty} 件</> : null}
            </Td>
            <Td align="right" className="font-medium tabular-nums text-neutral-800">{fmtWeight(row.stockWeight)}</Td>
            <Td align="right" className="tabular-nums text-neutral-400">{fmtWeight(row.lockedWeight)}</Td>
            <Td align="right">
              <span className="font-medium tabular-nums text-gold-700">{fmtWeight(row.availableWeight)}</span>
              <br />
              <StockBadge level={row.level} />
            </Td>
            <Td align="right" className="tabular-nums text-neutral-400">{fmtWeight(row.warnWeight)}</Td>
            <Td align="right">
              <span className="flex justify-end gap-1.5 text-[12.5px]">
                <button type="button" onClick={() => setOp({ type: 'in', row })} className="rounded bg-emerald-50 px-2 py-1 text-emerald-700 hover:bg-emerald-100">入库</button>
                <button type="button" onClick={() => setOp({ type: 'out', row })} className="rounded bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100">出库</button>
                <button type="button" onClick={() => setOp({ type: 'adjust', row })} className="rounded bg-neutral-100 px-2 py-1 text-neutral-600 hover:bg-neutral-200">盘点</button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <Pager pageNum={pageNum} pageSize={10} total={total} onChange={setPageNum} />

      {op && <StockOpModal op={op} onClose={() => setOp(null)} onDone={() => { setOp(null); load() }} />}
    </div>
  )
}

function StockOpModal({
  op,
  onClose,
  onDone,
}: {
  op: { type: OpType; row: Row }
  onClose: () => void
  onDone: () => void
}) {
  const { type, row } = op
  const [weight, setWeight] = useState(type === 'adjust' ? String(row.stockWeight) : '')
  const [reason, setReason] = useState('')
  const [refNo, setRefNo] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const submit = async () => {
    setSaving(true)
    try {
      const res = await api.post<{ beforeWeight: number; afterWeight: number }>(
        `/api/admin/stocks/${type}`,
        { skuId: row.id, weight: Number(weight), reason, refNo },
      )
      toast.success(`${OP_LABEL[type]}成功：${fmtWeight(res.beforeWeight)} g → ${fmtWeight(res.afterWeight)} g`)
      onDone()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const preview = (() => {
    const n = Number(weight)
    if (!Number.isFinite(n)) return null
    if (type === 'adjust') return n
    return type === 'in' ? row.stockWeight + n : row.stockWeight - n
  })()

  return (
    <Modal
      open
      onClose={onClose}
      title={`${OP_LABEL[type]} · ${row.productName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button loading={saving} onClick={submit} variant={type === 'out' ? 'danger' : 'primary'}>
            确认{OP_LABEL[type]}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-neutral-600">
          <p>规格：{row.specName} · {row.skuCode}</p>
          <p className="mt-0.5">
            当前总库存 <strong className="text-neutral-900">{fmtWeight(row.stockWeight)} g</strong>
            ，预占 {fmtWeight(row.lockedWeight)} g，可售 {fmtWeight(row.availableWeight)} g
          </p>
        </div>

        <Field
          label={type === 'adjust' ? '盘点后总克重 (g)' : `${OP_LABEL[type]}克重 (g)`}
          required
          hint="保留 3 位小数"
        >
          <input
            type="number"
            step="0.001"
            min={0}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
            autoFocus
          />
        </Field>

        {preview !== null && (
          <p className={`text-[12.5px] ${preview < 0 ? 'text-rose-600' : 'text-neutral-500'}`}>
            操作后总库存：<strong>{fmtWeight(Math.max(preview, 0))} g</strong>
            {preview < 0 && '（库存不足，无法出库）'}
          </p>
        )}

        <Field label="原因" required hint="必填，便于追溯">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder={type === 'in' ? '工厂到货' : type === 'out' ? '线下档口出货' : '月度盘点差异'}
          />
        </Field>
        <Field label="单据号" hint="可选，如采购单号 / 出库单号">
          <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  )
}
