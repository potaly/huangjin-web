'use client'

import { useEffect, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Loading, Tag } from '@/components/ui'
import {
  Field, Modal, PageTitle, StatusDot, Switch, inputCls, selectCls, useConfirm,
} from '@/components/admin/AdminUI'
import { ImageUpload } from '@/components/admin/ImageUpload'
import type { Banner, BannerLinkType } from '@/lib/types'

const LINK_LABEL: Record<BannerLinkType, string> = {
  NONE: '不跳转',
  PRODUCT: '商品详情',
  NOTICE: '公告详情',
  URL: '外部链接',
}

const EMPTY = {
  image: '',
  title: '',
  linkType: 'NONE' as BannerLinkType,
  linkValue: '',
  sort: 100,
  status: 1 as 0 | 1,
}

export default function BannerPage() {
  const [rows, setRows] = useState<Banner[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const load = () => {
    setError('')
    api.get<Banner[]>('/api/admin/banners').then(setRows).catch((e) => setError(errMsg(e)))
  }
  useEffect(load, [])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  const openEdit = (row: Banner) => {
    setEditing(row)
    setForm({
      image: row.image,
      title: row.title ?? '',
      linkType: row.linkType,
      linkValue: row.linkValue ?? '',
      sort: row.sort,
      status: row.status,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (editing) await api.put(`/api/admin/banners/${editing.id}`, form)
      else await api.post('/api/admin/banners', form)
      toast.success('保存成功')
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: Banner, status: boolean) => {
    try {
      await api.put(`/api/admin/banners/${row.id}`, { status: status ? 1 : 0 })
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  const remove = async (row: Banner) => {
    if (!(await confirm('确定删除这张轮播图吗？', { danger: true }))) return
    try {
      await api.del(`/api/admin/banners/${row.id}`)
      toast.success('删除成功')
      load()
    } catch (e) {
      toast.error(errMsg(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="轮播图管理"
        desc="首页顶部轮播，建议使用 2:1 比例的图片"
        actions={<Button onClick={openNew}>新增轮播图</Button>}
      />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!rows && !error && <Loading />}

      {rows && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.length === 0 && (
            <p className="col-span-full rounded-xl bg-white py-12 text-center text-[13px] text-neutral-400 ring-1 ring-neutral-100">
              还没有轮播图
            </p>
          )}
          {rows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.image} alt={row.title ?? ''} className="aspect-[2/1] w-full object-cover" />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[14px] font-medium text-neutral-900">{row.title || '未命名轮播图'}</p>
                    <p className="mt-0.5 text-[11.5px] text-neutral-400">
                      排序 {row.sort} · <Tag>{LINK_LABEL[row.linkType]}</Tag>
                      {row.linkValue && <span className="ml-1">{row.linkValue}</span>}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Switch checked={row.status === 1} onChange={(v) => toggle(row, v)} />
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <StatusDot on={row.status === 1} onText="展示中" offText="已隐藏" />
                  <span className="flex gap-2 text-[12.5px]">
                    <button type="button" onClick={() => openEdit(row)} className="text-gold-600 hover:underline">编辑</button>
                    <button type="button" onClick={() => remove(row)} className="text-rose-600 hover:underline">删除</button>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑轮播图' : '新增轮播图'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button loading={saving} onClick={save}>保存</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="轮播图片" required hint="建议 1200×600">
            <ImageUpload value={form.image} onChange={(image) => setForm({ ...form, image })} aspect="aspect-[2/1]" label="上传图片" />
          </Field>
          <Field label="标题" hint="仅后台识别用">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="跳转类型">
              <select
                value={form.linkType}
                onChange={(e) => setForm({ ...form, linkType: e.target.value as BannerLinkType, linkValue: '' })}
                className={selectCls}
              >
                {(Object.keys(LINK_LABEL) as BannerLinkType[]).map((k) => (
                  <option key={k} value={k}>{LINK_LABEL[k]}</option>
                ))}
              </select>
            </Field>
            {form.linkType !== 'NONE' && (
              <Field
                label="跳转目标"
                required
                hint={form.linkType === 'URL' ? '以 http:// 或 https:// 开头' : '填写对应的 ID'}
              >
                <input value={form.linkValue} onChange={(e) => setForm({ ...form, linkValue: e.target.value })} className={inputCls} />
              </Field>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="排序" hint="数字越小越靠前">
              <input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="状态">
              <span className="flex items-center gap-2 pt-1">
                <Switch checked={form.status === 1} onChange={(v) => setForm({ ...form, status: v ? 1 : 0 })} />
                <StatusDot on={form.status === 1} onText="展示中" offText="已隐藏" />
              </span>
            </Field>
          </div>
        </div>
      </Modal>

      {dialog}
    </div>
  )
}
