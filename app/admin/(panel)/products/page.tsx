'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, errMsg, qs } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, StockBadge, Tag } from '@/components/ui'
import {
  FilterBar, Field, PageTitle, Pager, Table, Td, inputCls, selectCls, useConfirm, useDebounced,
} from '@/components/admin/AdminUI'
import { fmtWeight, fmtDateTime } from '@/lib/format'
import type { Material, StockLevel } from '@/lib/types'

interface Row {
  id: number
  name: string
  styleNo: string
  cover?: string
  categoryName: string
  materialName: string
  isRecommend: boolean
  status: 0 | 1
  sort: number
  skuCount: number
  stockWeight: number
  availableWeight: number
  stockLevel: StockLevel
  updatedAt: string
}

interface CategoryNode {
  id: number
  name: string
  children: Array<{ id: number; name: string }>
}

export default function ProductListPage() {
  return (
    <Suspense fallback={<PageTitle title="商品管理" />}>
      <ProductList />
    </Suspense>
  )
}

function ProductList() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword)
  const [categoryId, setCategoryId] = useState(Number(searchParams.get('categoryId') ?? 0) || 0)
  const [materialId, setMaterialId] = useState(0)
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number[]>([])

  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    api.get<CategoryNode[]>('/api/admin/categories').then(setCategories).catch(() => {})
    api.get<Material[]>('/api/admin/materials').then(setMaterials).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setError('')
    setRows(null)
    api
      .get<{ records: Row[]; total: number }>(
        `/api/admin/products${qs({ keyword: debounced, categoryId: categoryId || '', materialId: materialId || '', status, pageNum, pageSize: 10 })}`,
      )
      .then((res) => {
        setRows(res.records)
        setTotal(res.total)
        setSelected([])
      })
      .catch((e) => setError(errMsg(e)))
  }, [debounced, categoryId, materialId, status, pageNum])

  useEffect(load, [load])
  useEffect(() => setPageNum(1), [debounced, categoryId, materialId, status])

  const toggleStatus = async (row: Row) => {
    try {
      await api.put(`/api/admin/products/${row.id}/status`, { status: row.status === 1 ? 0 : 1 })
      toast.success(row.status === 1 ? '已下架' : '已上架')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const batch = async (next: 0 | 1) => {
    if (selected.length === 0) return
    try {
      const res = await api.put<{ succeeded: number[]; skipped: Array<{ name: string; reason: string }> }>(
        '/api/admin/products/batch-status',
        { ids: selected, status: next },
      )
      if (res.skipped.length) {
        toast.error(`${res.skipped.length} 个未处理：${res.skipped.map((s) => `${s.name}(${s.reason})`).join('、')}`)
      } else {
        toast.success(`成功${next === 1 ? '上架' : '下架'} ${res.succeeded.length} 个商品`)
      }
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const copy = async (row: Row) => {
    if (!(await confirm(`复制「${row.name}」？副本库存为 0 且默认下架。`))) return
    try {
      const res = await api.post<{ id: number }>(`/api/admin/products/${row.id}/copy`)
      toast.success('复制成功')
      router.push(`/admin/products/${res.id}`)
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (row: Row) => {
    if (!(await confirm(`确定删除商品「${row.name}」吗？需先下架且库存为 0。`, { danger: true }))) return
    try {
      await api.del(`/api/admin/products/${row.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const allIds = rows?.map((r) => r.id) ?? []
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.includes(id))

  return (
    <div>
      <PageTitle
        title="商品管理"
        desc="一期不涉及价格；上架需至少一个启用 SKU 且已上传主图"
        actions={<Link href="/admin/products/new"><Button>新增商品</Button></Link>}
      />

      <FilterBar>
        <Field label="关键词" className="w-52">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="商品名称或款号"
            className={inputCls}
          />
        </Field>
        <Field label="分类" className="w-44">
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={selectCls}>
            <option value={0}>全部分类</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name}（全部）</option>
                {c.children.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="材质" className="w-36">
          <select value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))} className={selectCls}>
            <option value={0}>全部材质</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="状态" className="w-32">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="">全部</option>
            <option value="1">已上架</option>
            <option value="0">已下架</option>
          </select>
        </Field>
        <div className="ml-auto flex items-center gap-2">
          <label className="mr-1 flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => setSelected(e.target.checked ? allIds : [])}
              className="h-3.5 w-3.5 accent-gold-500"
            />
            全选本页
          </label>
          <Button variant="outline" size="sm" disabled={selected.length === 0} onClick={() => batch(1)}>
            批量上架{selected.length ? ` (${selected.length})` : ''}
          </Button>
          <Button variant="ghost" size="sm" disabled={selected.length === 0} onClick={() => batch(0)}>
            批量下架
          </Button>
        </div>
      </FilterBar>

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'check', label: '全选', width: '46px' },
          { key: 'product', label: '商品' },
          { key: 'category', label: '分类 / 材质', width: '160px' },
          { key: 'sku', label: 'SKU', align: 'right', width: '70px' },
          { key: 'stock', label: '库存 (g)', align: 'right', width: '140px' },
          { key: 'status', label: '状态', width: '110px' },
          { key: 'updated', label: '更新时间', width: '130px' },
          { key: 'ops', label: '操作', align: 'right', width: '180px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((row) => (
          <tr key={row.id} className="hover:bg-neutral-50/60">
            <Td>
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)))
                }
                aria-label={`选择 ${row.name}`}
                className="h-3.5 w-3.5 accent-gold-500"
              />
            </Td>
            <Td>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.cover || '/img/placeholder.svg'}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-neutral-100"
                />
                <div className="min-w-0">
                  <Link href={`/admin/products/${row.id}`} className="line-clamp-1 font-medium text-neutral-800 hover:text-gold-700">
                    {row.name}
                  </Link>
                  <p className="mt-0.5 text-[11.5px] text-neutral-400">
                    {row.styleNo}
                    {row.isRecommend && <Tag tone="gold" className="ml-1.5">推荐</Tag>}
                  </p>
                </div>
              </div>
            </Td>
            <Td className="text-[12.5px] text-neutral-500">
              {row.categoryName}
              <br />
              <span className="text-neutral-400">{row.materialName}</span>
            </Td>
            <Td align="right" className="text-neutral-600">{row.skuCount}</Td>
            <Td align="right">
              <span className="font-medium text-neutral-800">{fmtWeight(row.stockWeight)}</span>
              <br />
              <StockBadge level={row.stockLevel} />
            </Td>
            <Td>
              <button
                type="button"
                onClick={() => toggleStatus(row)}
                className={`rounded px-2 py-1 text-[12px] ${
                  row.status === 1
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {row.status === 1 ? '已上架' : '已下架'}
              </button>
            </Td>
            <Td className="text-[12px] text-neutral-400">{fmtDateTime(row.updatedAt)}</Td>
            <Td align="right">
              <span className="flex justify-end gap-2 text-[12.5px]">
                <Link href={`/admin/products/${row.id}`} className="text-gold-600 hover:underline">编辑</Link>
                <Link href={`/goods/${row.id}`} target="_blank" className="text-neutral-500 hover:underline">预览</Link>
                <button type="button" onClick={() => copy(row)} className="text-neutral-500 hover:underline">复制</button>
                <button type="button" onClick={() => remove(row)} className="text-rose-600 hover:underline">删除</button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <Pager pageNum={pageNum} pageSize={10} total={total} onChange={setPageNum} />
      {dialog}
    </div>
  )
}
