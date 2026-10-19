'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button, ErrorBox, Loading, StockBadge, Tag } from '@/components/ui'
import { Card, Field, PageTitle, StatusDot, Switch, inputCls, selectCls, useConfirm } from './AdminUI'
import { ImageUpload, ImagesUpload } from './ImageUpload'
import { RichEditor } from './RichEditor'
import { fmtWeight } from '@/lib/format'
import type { Material, ProductAttr, StockLevel } from '@/lib/types'

interface CategoryNode {
  id: number
  name: string
  children: Array<{ id: number; name: string }>
}

interface SkuRow {
  id?: number
  skuCode: string
  specName: string
  refWeight: string
  refQty: string
  warnWeight: string
  status: 0 | 1
  /** 仅新 SKU 可填 */
  initialWeight: string
  /** 已有 SKU 的只读库存 */
  stockWeight?: number
  availableWeight?: number
  level?: StockLevel
  _deleted?: boolean
}

interface FormState {
  name: string
  styleNo: string
  categoryId: number
  materialId: number
  cover: string
  images: string[]
  purity: string
  sizeDesc: string
  attrs: ProductAttr[]
  detailHtml: string
  isRecommend: boolean
  status: 0 | 1
  sort: number
  skus: SkuRow[]
}

const emptySku = (styleNo: string, index: number): SkuRow => ({
  skuCode: styleNo ? `${styleNo}-${String(index + 1).padStart(2, '0')}` : '',
  specName: '',
  refWeight: '',
  refQty: '',
  warnWeight: '0',
  status: 1,
  initialWeight: '',
})

const EMPTY: FormState = {
  name: '',
  styleNo: '',
  categoryId: 0,
  materialId: 0,
  cover: '',
  images: [],
  purity: '',
  sizeDesc: '',
  attrs: [],
  detailHtml: '',
  isRecommend: false,
  status: 0,
  sort: 100,
  skus: [],
}

export function ProductForm({ productId }: { productId?: number }) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(Boolean(productId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const router = useRouter()
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    api.get<CategoryNode[]>('/api/admin/categories').then(setCategories).catch(() => {})
    api.get<Material[]>('/api/admin/materials').then(setMaterials).catch(() => {})
  }, [])

  useEffect(() => {
    if (!productId) {
      setForm({ ...EMPTY, skus: [emptySku('', 0)] })
      return
    }
    setLoading(true)
    api
      .get<any>(`/api/admin/products/${productId}`)
      .then((p) => {
        setForm({
          name: p.name,
          styleNo: p.styleNo,
          categoryId: p.categoryId,
          materialId: p.materialId,
          cover: p.cover ?? '',
          images: p.images ?? [],
          purity: p.purity ?? '',
          sizeDesc: p.sizeDesc ?? '',
          attrs: p.attrs ?? [],
          detailHtml: p.detailHtml ?? '',
          isRecommend: Boolean(p.isRecommend),
          status: p.status,
          sort: p.sort,
          skus: (p.skus ?? []).map((s: any) => ({
            id: s.id,
            skuCode: s.skuCode,
            specName: s.specName,
            refWeight: s.refWeight == null ? '' : String(s.refWeight),
            refQty: s.refQty == null ? '' : String(s.refQty),
            warnWeight: String(s.warnWeight ?? 0),
            status: s.status,
            initialWeight: '',
            stockWeight: s.stockWeight,
            availableWeight: s.availableWeight,
            level: s.level,
          })),
        })
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [productId])

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }))

  const patchSku = (index: number, next: Partial<SkuRow>) =>
    setForm((prev) => ({
      ...prev,
      skus: prev.skus.map((s, i) => (i === index ? { ...s, ...next } : s)),
    }))

  const addSku = () =>
    setForm((prev) => ({ ...prev, skus: [...prev.skus, emptySku(prev.styleNo, prev.skus.length)] }))

  const removeSku = async (index: number) => {
    const sku = form.skus[index]
    if (!sku.id) {
      setForm((prev) => ({ ...prev, skus: prev.skus.filter((_, i) => i !== index) }))
      return
    }
    if (!(await confirm(`删除 SKU「${sku.specName || sku.skuCode}」？库存必须为 0。`, { danger: true }))) return
    patchSku(index, { _deleted: true })
  }

  const submit = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        skus: form.skus.map((s) => ({
          id: s.id,
          skuCode: s.skuCode,
          specName: s.specName,
          refWeight: s.refWeight === '' ? null : Number(s.refWeight),
          refQty: s.refQty === '' ? null : Number(s.refQty),
          warnWeight: s.warnWeight === '' ? 0 : Number(s.warnWeight),
          status: s.status,
          initialWeight: s.id || s.initialWeight === '' ? undefined : Number(s.initialWeight),
          _deleted: s._deleted,
        })),
      }
      if (productId) {
        await api.put(`/api/admin/products/${productId}`, payload)
        toast.success('保存成功')
        router.refresh()
      } else {
        const res = await api.post<{ id: number }>('/api/admin/products', payload)
        toast.success('创建成功')
        router.replace(`/admin/products/${res.id}`)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading text="加载商品数据…" />
  if (error) return <ErrorBox text={error} />

  const liveSkus = form.skus.filter((s) => !s._deleted)

  return (
    <div className="pb-20">
      <PageTitle
        title={productId ? '编辑商品' : '新增商品'}
        desc={productId ? `商品 ID ${productId}` : '保存后可在列表中上架'}
        actions={
          <>
            <Link href="/admin/products">
              <Button variant="ghost">返回列表</Button>
            </Link>
            {productId && (
              <Link href={`/goods/${productId}`} target="_blank">
                <Button variant="outline">前台预览</Button>
              </Link>
            )}
            <Button loading={saving} onClick={submit}>
              保存
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">基本信息</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="商品名称" required className="sm:col-span-2">
                <input value={form.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} placeholder="如：足金999 古法转运珠手链" />
              </Field>
              <Field label="款式编号" required hint="全站唯一，客户凭款号咨询">
                <input
                  value={form.styleNo}
                  onChange={(e) => {
                    const styleNo = e.target.value.toUpperCase()
                    // 新建时同步更新尚未保存的 SKU 编码
                    setForm((prev) => ({
                      ...prev,
                      styleNo,
                      skus: prev.skus.map((s, i) =>
                        s.id ? s : { ...s, skuCode: styleNo ? `${styleNo}-${String(i + 1).padStart(2, '0')}` : '' },
                      ),
                    }))
                  }}
                  className={inputCls}
                  placeholder="SL-2201"
                />
              </Field>
              <Field label="排序" hint="数字越小越靠前">
                <input type="number" value={form.sort} onChange={(e) => patch({ sort: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="商品分类" required>
                <select value={form.categoryId} onChange={(e) => patch({ categoryId: Number(e.target.value) })} className={selectCls}>
                  <option value={0}>请选择分类</option>
                  {categories.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.id}>{c.name}</option>
                      {c.children.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="材质" required>
                <select value={form.materialId} onChange={(e) => patch({ materialId: Number(e.target.value) })} className={selectCls}>
                  <option value={0}>请选择材质</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="成色" hint="留空则使用材质默认成色">
                <input value={form.purity} onChange={(e) => patch({ purity: e.target.value })} className={inputCls} placeholder="999‰" />
              </Field>
              <Field label="尺寸说明">
                <input value={form.sizeDesc} onChange={(e) => patch({ sizeDesc: e.target.value })} className={inputCls} placeholder="手围 15–17cm 可调" />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-[15px] font-semibold text-neutral-900">规格属性</h2>
            <p className="mb-3 text-[12px] text-neutral-400">自定义键值对，前台详情页原样展示</p>
            <div className="space-y-2">
              {form.attrs.map((attr, i) => (
                <div key={i} className="grid grid-cols-[150px_1fr_auto] gap-2">
                  <input
                    value={attr.name}
                    onChange={(e) =>
                      patch({ attrs: form.attrs.map((a, idx) => (idx === i ? { ...a, name: e.target.value } : a)) })
                    }
                    placeholder="属性名，如 工艺"
                    className={inputCls}
                  />
                  <input
                    value={attr.value}
                    onChange={(e) =>
                      patch({ attrs: form.attrs.map((a, idx) => (idx === i ? { ...a, value: e.target.value } : a)) })
                    }
                    placeholder="属性值，如 古法哑光"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ attrs: form.attrs.filter((_, idx) => idx !== i) })}
                    className="shrink-0 rounded-lg px-2.5 text-[12.5px] text-rose-600 hover:bg-rose-50"
                  >
                    删除
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ attrs: [...form.attrs, { name: '', value: '' }] })}
              >
                + 添加属性
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-neutral-900">SKU 与库存</h2>
              <Button variant="ghost" size="sm" onClick={addSku}>
                + 添加 SKU
              </Button>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-neutral-400">
              无规格时规格名填「默认」。已保存 SKU 的库存只能在
              <Link href="/admin/stocks" className="mx-1 text-gold-600 hover:underline">库存管理</Link>
              中调整，以保证流水完整。
            </p>

            <div className="space-y-3">
              {liveSkus.length === 0 && (
                <p className="rounded-lg bg-neutral-50 py-6 text-center text-[13px] text-neutral-400">
                  至少需要一个 SKU
                </p>
              )}

              {form.skus.map((sku, index) =>
                sku._deleted ? null : (
                  <div key={sku.id ?? `new-${index}`} className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-100">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12.5px] text-neutral-500">
                        {sku.id ? <Tag tone="blue">已保存</Tag> : <Tag tone="green">新增</Tag>}
                        {sku.id && sku.level && <StockBadge level={sku.level} />}
                        {sku.id && (
                          <span className="text-neutral-400">
                            当前库存 {fmtWeight(sku.stockWeight ?? 0)} g
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <Switch checked={sku.status === 1} onChange={(v) => patchSku(index, { status: v ? 1 : 0 })} />
                        <StatusDot on={sku.status === 1} />
                        <button
                          type="button"
                          onClick={() => removeSku(index)}
                          className="rounded px-2 py-1 text-[12.5px] text-rose-600 hover:bg-rose-50"
                        >
                          删除
                        </button>
                      </span>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="规格名" required>
                        <input
                          value={sku.specName}
                          onChange={(e) => patchSku(index, { specName: e.target.value })}
                          className={inputCls}
                          placeholder="圈口 12 / 默认"
                        />
                      </Field>
                      <Field label="SKU 编码" required>
                        <input
                          value={sku.skuCode}
                          onChange={(e) => patchSku(index, { skuCode: e.target.value.toUpperCase() })}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="参考单件克重 (g)" hint="可空，仅展示">
                        <input
                          type="number"
                          step="0.001"
                          value={sku.refWeight}
                          onChange={(e) => patchSku(index, { refWeight: e.target.value })}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="参考件数" hint="可空，不参与计算">
                        <input
                          type="number"
                          value={sku.refQty}
                          onChange={(e) => patchSku(index, { refQty: e.target.value })}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="预警克数 (g)" hint="可售低于该值时工作台提示">
                        <input
                          type="number"
                          step="0.001"
                          value={sku.warnWeight}
                          onChange={(e) => patchSku(index, { warnWeight: e.target.value })}
                          className={inputCls}
                        />
                      </Field>
                      {!sku.id && (
                        <Field label="初始库存 (g)" hint="保存时自动生成入库流水">
                          <input
                            type="number"
                            step="0.001"
                            value={sku.initialWeight}
                            onChange={(e) => patchSku(index, { initialWeight: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">商品详情</h2>
            <RichEditor
              value={form.detailHtml}
              onChange={(detailHtml) => patch({ detailHtml })}
              placeholder="介绍工艺、适用人群、批发说明…"
              minHeight={220}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">商品图片</h2>
            <Field label="主图" required hint="上架前必须上传">
              <ImageUpload value={form.cover} onChange={(cover) => patch({ cover })} label="上传主图" />
            </Field>
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] text-neutral-600">轮播图（最多 9 张）</p>
              <ImagesUpload value={form.images} onChange={(images) => patch({ images })} />
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold text-neutral-900">上架设置</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] text-neutral-700">首页推荐</span>
                <Switch checked={form.isRecommend} onChange={(isRecommend) => patch({ isRecommend })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] text-neutral-700">立即上架</span>
                <Switch checked={form.status === 1} onChange={(v) => patch({ status: v ? 1 : 0 })} />
              </div>
              <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] leading-relaxed text-neutral-500">
                上架校验：至少一个启用 SKU、主图已上传。
                <br />
                当前：{liveSkus.filter((s) => s.status === 1).length} 个启用 SKU，主图
                {form.cover ? '已上传' : '未上传'}。
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-[15px] font-semibold text-neutral-900">二期预留</h2>
            <p className="text-[12px] leading-relaxed text-neutral-400">
              每克工费、每克附加费，以及 SKU 的起订克数与步长，将在二期上线计价功能时在此处配置。
            </p>
          </Card>
        </div>
      </div>

      {dialog}
    </div>
  )
}
