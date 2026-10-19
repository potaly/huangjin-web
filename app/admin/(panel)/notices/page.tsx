'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, errMsg, qs } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Tag } from '@/components/ui'
import {
  Field, FilterBar, Modal, PageTitle, Pager, Table, Td, inputCls, selectCls, useConfirm, useDebounced,
} from '@/components/admin/AdminUI'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { RichEditor } from '@/components/admin/RichEditor'
import { fmtDateTime } from '@/lib/format'
import type { Notice } from '@/lib/types'

interface Row extends Notice {
  summary: string
  visible: boolean
}

const STATUS_LABEL: Record<number, string> = { 0: '草稿', 1: '已发布', 2: '已下线' }

const EMPTY = {
  title: '',
  cover: '',
  contentHtml: '',
  isTop: false,
  isPopup: false,
  status: 0 as 0 | 1 | 2,
  publishAt: '',
  expireAt: '',
}

/** ISO → datetime-local 输入值 */
const toLocal = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NoticePage() {
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword)
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const load = useCallback(() => {
    setError('')
    setRows(null)
    api
      .get<{ records: Row[]; total: number }>(
        `/api/admin/notices${qs({ keyword: debounced, status, pageNum, pageSize: 10 })}`,
      )
      .then((res) => {
        setRows(res.records)
        setTotal(res.total)
      })
      .catch((e) => setError(errMsg(e)))
  }, [debounced, status, pageNum])

  useEffect(load, [load])
  useEffect(() => setPageNum(1), [debounced, status])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditing(row)
    setForm({
      title: row.title,
      cover: row.cover ?? '',
      contentHtml: row.contentHtml ?? '',
      isTop: row.isTop,
      isPopup: row.isPopup,
      status: row.status,
      publishAt: toLocal(row.publishAt),
      expireAt: toLocal(row.expireAt),
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : '',
        expireAt: form.expireAt ? new Date(form.expireAt).toISOString() : '',
      }
      if (editing) await api.put(`/api/admin/notices/${editing.id}`, payload)
      else await api.post('/api/admin/notices', payload)
      toast.success('保存成功')
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const setStatusOf = async (row: Row, next: 0 | 1 | 2) => {
    try {
      await api.put(`/api/admin/notices/${row.id}`, { status: next })
      toast.success(`已${STATUS_LABEL[next]}`)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (row: Row) => {
    if (!(await confirm(`确定删除公告「${row.title}」吗？`, { danger: true }))) return
    try {
      await api.del(`/api/admin/notices/${row.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="公告管理"
        desc="前台只展示「已发布且在生效时间内」的公告，置顶优先"
        actions={<Button onClick={openNew}>新增公告</Button>}
      />

      <FilterBar>
        <Field label="标题关键词" className="w-56">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className={inputCls} placeholder="搜索公告标题" />
        </Field>
        <Field label="状态" className="w-32">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="">全部</option>
            <option value="0">草稿</option>
            <option value="1">已发布</option>
            <option value="2">已下线</option>
          </select>
        </Field>
      </FilterBar>

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'title', label: '标题' },
          { key: 'flags', label: '标记', width: '140px' },
          { key: 'status', label: '状态', width: '120px' },
          { key: 'time', label: '生效时间', width: '190px' },
          { key: 'ops', label: '操作', align: 'right', width: '190px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((row) => (
          <tr key={row.id} className="hover:bg-neutral-50/60">
            <Td>
              <p className="line-clamp-1 font-medium text-neutral-800">{row.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[11.5px] text-neutral-400">{row.summary || '（无正文）'}</p>
            </Td>
            <Td>
              <span className="flex flex-wrap gap-1">
                {row.isTop && <Tag tone="red">置顶</Tag>}
                {row.isPopup && <Tag tone="gold">首页弹窗</Tag>}
                {!row.isTop && !row.isPopup && <span className="text-[12px] text-neutral-300">—</span>}
              </span>
            </Td>
            <Td>
              <Tag tone={row.status === 1 ? (row.visible ? 'green' : 'blue') : 'neutral'}>
                {STATUS_LABEL[row.status]}
              </Tag>
              {row.status === 1 && !row.visible && (
                <p className="mt-0.5 text-[11px] text-neutral-400">不在生效时间内</p>
              )}
            </Td>
            <Td className="text-[12px] text-neutral-500">
              {fmtDateTime(row.publishAt)}
              <br />
              <span className="text-neutral-400">至 {row.expireAt ? fmtDateTime(row.expireAt) : '长期'}</span>
            </Td>
            <Td align="right">
              <span className="flex flex-wrap justify-end gap-2 text-[12.5px]">
                <button type="button" onClick={() => openEdit(row)} className="text-gold-600 hover:underline">编辑</button>
                {row.status !== 1 && (
                  <button type="button" onClick={() => setStatusOf(row, 1)} className="text-emerald-600 hover:underline">发布</button>
                )}
                {row.status === 1 && (
                  <button type="button" onClick={() => setStatusOf(row, 2)} className="text-neutral-500 hover:underline">下线</button>
                )}
                <button type="button" onClick={() => remove(row)} className="text-rose-600 hover:underline">删除</button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <Pager pageNum={pageNum} pageSize={10} total={total} onChange={setPageNum} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑公告 · ${editing.title}` : '新增公告'}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button loading={saving} onClick={save}>保存</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="标题" required>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="封面" hint="可选，列表与弹窗中展示">
            <ImageUpload value={form.cover} onChange={(cover) => setForm({ ...form, cover })} aspect="aspect-[2/1]" />
          </Field>
          <Field label="正文" required>
            <RichEditor value={form.contentHtml} onChange={(contentHtml) => setForm({ ...form, contentHtml })} minHeight={180} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="生效时间" hint="留空则保存即生效">
              <input type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} className={inputCls} />
            </Field>
            <Field label="失效时间" hint="留空表示长期有效">
              <input type="datetime-local" value={form.expireAt} onChange={(e) => setForm({ ...form, expireAt: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5 rounded-lg bg-neutral-50 px-3 py-2.5">
            <label className="flex items-center gap-2 text-[13px] text-neutral-700">
              <input type="checkbox" checked={form.isTop} onChange={(e) => setForm({ ...form, isTop: e.target.checked })} className="h-3.5 w-3.5 accent-gold-500" />
              置顶
            </label>
            <label className="flex items-center gap-2 text-[13px] text-neutral-700">
              <input type="checkbox" checked={form.isPopup} onChange={(e) => setForm({ ...form, isPopup: e.target.checked })} className="h-3.5 w-3.5 accent-gold-500" />
              首页弹窗（访客每天首次进入时弹出一次）
            </label>
            <label className="flex w-40 items-center gap-2 text-[13px] text-neutral-700">
              状态
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: Number(e.target.value) as 0 | 1 | 2 })}
                className={`${selectCls} py-1`}
              >
                <option value={0}>草稿</option>
                <option value={1}>已发布</option>
                <option value={2}>已下线</option>
              </select>
            </label>
          </div>
        </div>
      </Modal>

      {dialog}
    </div>
  )
}
