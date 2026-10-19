'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, errMsg } from '@/lib/client'
import type { MallProductDetail } from '@/lib/api-types'
import { PageHeader } from '@/components/mall/MallShell'
import { ProductCard } from '@/components/mall/ProductCard'
import { useMall } from '@/components/mall/MallProvider'
import { useToast } from '@/components/Toast'
import { ErrorBox, Loading, StockBadge, Tag } from '@/components/ui'
import { fmtWeight } from '@/lib/format'
import { copyText } from '@/lib/clipboard'

export default function GoodsDetailPage() {
  const params = useParams<{ id: string }>()
  const [product, setProduct] = useState<MallProductDetail | null>(null)
  const [error, setError] = useState('')
  const [imgIndex, setImgIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const { openContact } = useMall()
  const toast = useToast()

  const load = () => {
    setError('')
    api
      .get<MallProductDetail>(`/api/mall/products/${params.id}`)
      .then(setProduct)
      .catch((e) => setError(errMsg(e)))
  }

  useEffect(load, [params.id])

  /** §4.3：点击咨询客服，自动复制「商品名 + 款号 + 规格」便于粘贴到微信 */
  const consult = () => {
    if (!product) return
    const specs = product.skus.map((s) => s.specName).filter((s) => s && s !== '默认')
    const text = [
      product.name,
      `款号 ${product.styleNo}`,
      specs.length ? `规格 ${specs.join(' / ')}` : '',
    ]
      .filter(Boolean)
      .join('，')
    openContact(text)
  }

  const copyLink = async () => {
    const ok = await copyText(window.location.href)
    toast[ok ? 'success' : 'error'](ok ? '商品链接已复制，可转发给同事' : '复制失败，请手动复制地址栏')
  }

  const copyStyleNo = async () => {
    if (!product) return
    const ok = await copyText(product.styleNo)
    toast[ok ? 'success' : 'error'](ok ? `款号 ${product.styleNo} 已复制` : '复制失败')
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="商品详情"
        right={
          <button
            type="button"
            onClick={copyLink}
            className="mr-1 rounded-full px-2.5 py-1.5 text-[12px] text-neutral-500 active:bg-neutral-100"
          >
            复制链接
          </button>
        }
      />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!product && !error && <Loading />}

      {product && (
        <>
          {/* 图片轮播 */}
          <div className="relative bg-white">
            <div
              ref={trackRef}
              onScroll={(e) => setImgIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              className="no-scrollbar snap-x-mandatory flex overflow-x-auto"
            >
              {(product.images.length ? product.images : ['/img/placeholder.svg']).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt={`${product.name} 图 ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={`snap-center aspect-square w-full flex-shrink-0 object-cover ${
                    product.stockLevel === 'SOLD_OUT' ? 'opacity-60 grayscale' : ''
                  }`}
                />
              ))}
            </div>
            {product.images.length > 1 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white">
                {imgIndex + 1}/{product.images.length}
              </span>
            )}
            {product.offSale && (
              <span className="absolute left-3 top-3 rounded bg-neutral-800/85 px-2 py-1 text-[11px] text-white">
                该商品已下架
              </span>
            )}
          </div>

          {/* 标题区 */}
          <section className="mt-2 bg-white px-4 py-3.5">
            <h1 className="text-[17px] font-semibold leading-snug text-neutral-900">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Tag tone="gold">{product.materialName}</Tag>
              {product.purity && <Tag>成色 {product.purity}</Tag>}
              <StockBadge level={product.stockLevel} />
            </div>
            <button
              type="button"
              onClick={copyStyleNo}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[12px] text-neutral-600 active:bg-neutral-100"
            >
              款号 {product.styleNo}
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                <rect x="2.5" y="2.5" width="7" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 2.5V1.8A.8.8 0 015.8 1h5.4a.8.8 0 01.8.8v6.4a.8.8 0 01-.8.8h-.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              点击复制
            </button>
            <p className="mt-2.5 rounded-lg bg-gold-50 px-3 py-2 text-[12px] leading-relaxed text-gold-800">
              本站按克批发，前台不展示价格。如需当日报价与起订量，请点击下方「咨询客服」。
            </p>
          </section>

          {/* 规格属性表 */}
          <section className="mt-2 bg-white px-4 py-3.5">
            <h2 className="mb-2.5 text-[15px] font-semibold text-neutral-900">规格属性</h2>
            <dl className="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-neutral-50/70">
              <AttrRow label="材质" value={product.materialName} />
              {product.purity && <AttrRow label="成色" value={product.purity} />}
              {product.sizeDesc && <AttrRow label="尺寸说明" value={product.sizeDesc} />}
              <AttrRow label="款式编号" value={product.styleNo} />
              <AttrRow
                label="所属分类"
                value={[product.parentCategoryName, product.categoryName].filter(Boolean).join(' / ')}
              />
              {product.attrs.map((a) => (
                <AttrRow key={a.name} label={a.name} value={a.value} />
              ))}
            </dl>
          </section>

          {/* SKU 库存：一期平铺展示，无需选择 */}
          <section className="mt-2 bg-white px-4 py-3.5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-neutral-900">规格与库存</h2>
              <span className="text-[11px] text-neutral-400">
                {product.stockDisplayMode === 'EXACT' ? '单位：克（g）' : '库存状态'}
              </span>
            </div>
            <ul className="space-y-2">
              {product.skus.map((sku) => (
                <li
                  key={sku.id}
                  className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-neutral-800">{sku.specName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                      {sku.skuCode}
                      {sku.refWeight ? ` · 参考 ${sku.refWeight} g/件` : ''}
                      {sku.refQty ? ` · 约 ${sku.refQty} 件` : ''}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    {product.stockDisplayMode === 'EXACT' && sku.availableWeight !== undefined ? (
                      <p className="text-[13.5px] font-semibold text-gold-700">
                        {fmtWeight(sku.availableWeight)}
                        <span className="ml-0.5 text-[11px] font-normal text-neutral-400">g</span>
                      </p>
                    ) : null}
                    <StockBadge level={sku.level} className="mt-0.5" />
                  </div>
                </li>
              ))}
              {product.skus.length === 0 && (
                <li className="rounded-lg bg-neutral-50 py-6 text-center text-[13px] text-neutral-400">
                  暂无可售规格
                </li>
              )}
            </ul>
            <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-400">
              参考单件克重与件数仅供估算，实际发货以复称克重为准。
            </p>
          </section>

          {/* 商品详情富文本 */}
          {product.detailHtml && (
            <section className="mt-2 bg-white px-4 py-3.5">
              <h2 className="mb-2.5 text-[15px] font-semibold text-neutral-900">商品详情</h2>
              {/* 内容已在服务端经白名单过滤（§8.1） */}
              <div className="rich-text" dangerouslySetInnerHTML={{ __html: product.detailHtml }} />
            </section>
          )}

          {/* 同类推荐 */}
          {product.related.length > 0 && (
            <section className="mt-2 bg-white px-3 py-3.5">
              <h2 className="mb-2.5 px-1 text-[15px] font-semibold text-neutral-900">同类款式</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {product.related.map((p) => (
                  <ProductCard key={p.id} product={p} mode={product.stockDisplayMode} />
                ))}
              </div>
            </section>
          )}

          <p className="px-6 py-6 text-center text-[11px] text-neutral-400">
            — 二期将在此处上线加入购物车、按克下单与预估计价 —
          </p>

          {/* 底部固定按钮栏：一期只有「咨询客服」 */}
          <div className="mall-fixed-bar safe-bottom border-t border-neutral-100 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <Link
                href="/goods"
                className="flex h-11 w-[84px] shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-[11px] text-neutral-600"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
                  <rect x="3" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="11" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="3" y="11" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="11" y="11" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                全部款式
              </Link>
              <button
                type="button"
                onClick={consult}
                className="h-11 flex-1 rounded-xl bg-gold-500 text-[15px] font-medium text-white active:bg-gold-600"
              >
                咨询客服 · 获取报价
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AttrRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3 px-3 py-2.5">
      <dt className="w-[76px] shrink-0 text-[12.5px] text-neutral-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-neutral-800">{value}</dd>
    </div>
  )
}
