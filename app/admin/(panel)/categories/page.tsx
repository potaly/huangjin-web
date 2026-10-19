'use client'

import { useEffect, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Loading } from '@/components/ui'
import {
  Field, Modal, PageTitle, StatusDot, Switch, inputCls, useConfirm,
} from '@/components/admin/AdminUI'
import { ImageUpload } from '@/components/admin/ImageUpload'
import type { Category } from '@/lib/types'

interface Node extends Category {
  productCount: number
  children?: Node[]
}

const EMPTY = { name: '', icon: '', sort: 100, status: 1 as 0 | 1, parentId: 0 }

export default function CategoryPage() {
  const [tree, setTree] = useState<Node[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Node | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const load = () => {
    setError('')
    api.get<Node[]>('/api/admin/categories').then(setTree).catch((e) => setError(errMsg(e)))
  }
  useEffect(load, [])

  const openNew = (parentId: number) => {
    setEditing(null)
    setForm({ ...EMPTY, parentId })
    setOpen(true)
  }

  const openEdit = (node: Node) => {
    setEditing(node)
    setForm({
      name: node.name,
      icon: node.icon ?? '',
      sort: node.sort,
      status: node.status,
      parentId: node.parentId,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) await api.put(`/api/admin/categories/${editing.id}`, form)
      else await api.post('/api/admin/categories', form)
      toast.success('保存成功')
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (node: Node, status: boolean) => {
    try {
      await api.put(`/api/admin/categories/${node.id}`, { status: status ? 1 : 0 })
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (node: Node) => {
    if (!(await confirm(`确定删除分类「${node.name}」吗？`, { danger: true }))) return
    try {
      await api.del(`/api/admin/categories/${node.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="商品分类"
        desc="最多两级；停用一级分类会同步停用其下的二级分类"
        actions={<Button onClick={() => openNew(0)}>新增一级分类</Button>}
      />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!tree && !error && <Loading />}

      {tree && (
        <div className="space-y-3">
          {tree.length === 0 && (
            <p className="rounded-xl bg-white py-12 text-center text-[13px] text-neutral-400 ring-1 ring-neutral-100">
              还没有分类，点击右上角新增
            </p>
          )}

          {tree.map((parent) => (
            <section key={parent.id} className="rounded-xl bg-white shadow-card ring-1 ring-neutral-100">
              <header className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
                {parent.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={parent.icon} alt="" className="h-9 w-9 rounded-lg" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50 text-[13px] text-gold-600">
                    {parent.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-neutral-900">{parent.name}</p>
                  <p className="text-[11.5px] text-neutral-400">
                    排序 {parent.sort} · {parent.children?.length ?? 0} 个二级分类 · {parent.productCount} 个商品
                  </p>
                </div>
                <Switch checked={parent.status === 1} onChange={(v) => toggle(parent, v)} />
                <StatusDot on={parent.status === 1} />
                <span className="flex gap-2 text-[12.5px]">
                  <button type="button" onClick={() => openNew(parent.id)} className="text-gold-600 hover:underline">
                    添加二级
                  </button>
                  <button type="button" onClick={() => openEdit(parent)} className="text-neutral-500 hover:underline">
                    编辑
                  </button>
                  <button type="button" onClick={() => remove(parent)} className="text-rose-600 hover:underline">
                    删除
                  </button>
                </span>
              </header>

              {parent.children && parent.children.length > 0 && (
                <ul className="divide-y divide-neutral-50">
                  {parent.children.map((child) => (
                    <li key={child.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 pl-12">
                      <span className="min-w-0 flex-1 text-[13.5px] text-neutral-800">
                        {child.name}
                        <span className="ml-2 text-[11.5px] text-neutral-400">
                          排序 {child.sort} · {child.productCount} 个商品
                        </span>
                      </span>
                      <Switch checked={child.status === 1} onChange={(v) => toggle(child, v)} />
                      <StatusDot on={child.status === 1} />
                      <span className="flex gap-2 text-[12.5px]">
                        <button type="button" onClick={() => openEdit(child)} className="text-neutral-500 hover:underline">
                          编辑
                        </button>
                        <button type="button" onClick={() => remove(child)} className="text-rose-600 hover:underline">
                          删除
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑分类 · ${editing.name}` : form.parentId === 0 ? '新增一级分类' : '新增二级分类'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button loading={saving} onClick={save}>保存</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="分类名称" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </Field>
          {form.parentId === 0 && (
            <Field label="分类图标" hint="建议正方形，首页分类入口展示">
              <ImageUpload value={form.icon} onChange={(icon) => setForm({ ...form, icon })} label="上传图标" />
            </Field>
          )}
          <Field label="排序" hint="数字越小越靠前">
            <input
              type="number"
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="状态">
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
