'use client'

import { useEffect, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox } from '@/components/ui'
import {
  Field, Modal, PageTitle, StatusDot, Switch, Table, Td, inputCls, useConfirm,
} from '@/components/admin/AdminUI'
import type { Material } from '@/lib/types'

interface Row extends Material {
  productCount: number
}

const EMPTY = { code: '', name: '', purity: '', sort: 100, status: 1 as 0 | 1 }

export default function MaterialPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const load = () => {
    setError('')
    api.get<Row[]>('/api/admin/materials').then(setRows).catch((e) => setError(errMsg(e)))
  }
  useEffect(load, [])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      purity: row.purity ?? '',
      sort: row.sort,
      status: row.status,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) await api.put(`/api/admin/materials/${editing.id}`, form)
      else await api.post('/api/admin/materials', form)
      toast.success('保存成功')
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: Row, status: boolean) => {
    try {
      await api.put(`/api/admin/materials/${row.id}`, { status: status ? 1 : 0 })
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (row: Row) => {
    if (!(await confirm(`确定删除材质「${row.name}」吗？`, { danger: true }))) return
    try {
      await api.del(`/api/admin/materials/${row.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="材质字典"
        desc="商品按材质分类计价，二期的金价也按材质逐日录入"
        actions={<Button onClick={openNew}>新增材质</Button>}
      />

      {error && <ErrorBox text={error} onRetry={load} />}

      <Table
        columns={[
          { key: 'code', label: '编码', width: '120px' },
          { key: 'name', label: '名称' },
          { key: 'purity', label: '成色', width: '110px' },
          { key: 'count', label: '关联商品', align: 'right', width: '100px' },
          { key: 'sort', label: '排序', align: 'right', width: '80px' },
          { key: 'status', label: '状态', width: '110px' },
          { key: 'ops', label: '操作', align: 'right', width: '150px' },
        ]}
        loading={rows === null}
        empty={rows?.length === 0}
      >
        {rows?.map((row) => (
          <tr key={row.id} className="hover:bg-neutral-50/60">
            <Td><code className="text-[12px] text-neutral-500">{row.code}</code></Td>
            <Td className="font-medium text-neutral-800">{row.name}</Td>
            <Td className="text-neutral-500">{row.purity || '—'}</Td>
            <Td align="right" className="text-neutral-600">{row.productCount}</Td>
            <Td align="right" className="text-neutral-400">{row.sort}</Td>
            <Td>
              <span className="flex items-center gap-2">
                <Switch checked={row.status === 1} onChange={(v) => toggle(row, v)} />
                <StatusDot on={row.status === 1} />
              </span>
            </Td>
            <Td align="right">
              <span className="flex justify-end gap-2">
                <button type="button" onClick={() => openEdit(row)} className="text-[12.5px] text-gold-600 hover:underline">
                  编辑
                </button>
                <button type="button" onClick={() => remove(row)} className="text-[12.5px] text-rose-600 hover:underline">
                  删除
                </button>
              </span>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑材质 · ${editing.name}` : '新增材质'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button loading={saving} onClick={save}>保存</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="材质编码" required hint="大写字母数字，如 AU999">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={inputCls}
              placeholder="AU999"
            />
          </Field>
          <Field label="材质名称" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="足金999" />
          </Field>
          <Field label="成色" hint="如 999‰">
            <input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} className={inputCls} placeholder="999‰" />
          </Field>
          <Field label="排序" hint="数字越小越靠前">
            <input
              type="number"
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="状态" className="sm:col-span-2">
            <span className="flex items-center gap-2 pt-1">
              <Switch checked={form.status === 1} onChange={(v) => setForm({ ...form, status: v ? 1 : 0 })} />
              <StatusDot on={form.status === 1} />
            </span>
          </Field>
        </div>
      </Modal>

      {dialog}
    </div>
  )
}
