'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, errMsg, qs } from '@/lib/client'
import type { MallCategoryNode, MallMaterial, MallProductCard, MallProductPage } from '@/lib/api-types'
import type { StockDisplayMode } from '@/lib/types'
import { PageHeader } from '@/components/mall/MallShell'
import { ProductCard, ProductCardSkeleton } from '@/components/mall/ProductCard'
import { Empty, ErrorBox, Spinner } from '@/components/ui'

const PAGE_SIZE = 10

const SORTS = [
  { key: 'default', label: '综合' },
  { key: 'stock', label: '库存克数' },
  { key: 'new', label: '上新' },
] as const

export default function GoodsListPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeader title="商品列表" />
          <div className="grid grid-cols-2 gap-2.5 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <GoodsList />
    </Suspense>
  )
}

function GoodsList() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')
  const [categoryId, setCategoryId] = useState(Number(searchParams.get('categoryId') ?? 0) || 0)
  const [materialId, setMaterialId] = useState(Number(searchParams.get('materialId') ?? 0) || 0)
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'default')
  const recommend = searchParams.get('recommend') === '1'

  const [items, setItems] = useState<MallProductCard[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [mode, setMode] = useState<StockDisplayMode>('EXACT')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const [categories, setCategories] = useState<MallCategoryNode[]>([])
  const [materials, setMaterials] = useState<MallMaterial[]>([])

  useEffect(() => {
    api.get<MallCategoryNode[]>('/api/mall/categories').then(setCategories).catch(() => {})
    api.get<MallMaterial[]>('/api/mall/materials').then(setMaterials).catch(() => {})
  }, [])

  const query = useMemo(
    () => ({ keyword, categoryId: categoryId || '', materialId: materialId || '', sort, recommend: recommend ? 1 : '' }),
    [keyword, categoryId, materialId, sort, recommend],
  )

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const res = await api.get<MallProductPage>(
          `/api/mall/products${qs({ ...query, pageNum: page, pageSize: PAGE_SIZE })}`,
        )
        setMode(res.stockDisplayMode)
        setTotal(res.total)
        setPageNum(res.pageNum)
        setItems((prev) => (append ? [...prev, ...res.records] : res.records))
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [query],
  )

  useEffect(() => {
    void fetchPage(1, false)
  }, [fetchPage])

  // 上拉加载
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = items.length < total
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loading || loadingMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchPage(pageNum + 1, true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadingMore, pageNum, fetchPage])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    void fetchPage(1, false)
  }

  const activeCategoryName =
    categories.flatMap((c) => [c, ...c.children]).find((c) => c.id === categoryId)?.name ?? ''
  const activeMaterialName = materials.find((m) => m.id === materialId)?.name ?? ''
  const filterCount = (categoryId ? 1 : 0) + (materialId ? 1 : 0)

  return (
    <div>
      <PageHeader title={recommend ? '推荐款式' : activeCategoryName || '商品列表'} />

      {/* 搜索与筛选 */}
      <div className="sticky top-12 z-20 border-b border-neutral-100 bg-white px-3 pb-2 pt-2">
        <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-2">
          <svg width="15" height="15" viewBox="0 0 16 16" className="shrink-0 text-neutral-400" aria-hidden>
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索商品名称或款号"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
          {keyword && (
            <button
              type="button"
              aria-label="清空"
              onClick={() => {
                setKeyword('')
              }}
              className="shrink-0 text-neutral-400"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="7" r="6.2" fill="currentColor" opacity=".3" />
                <path d="M5 5l4 4M9 5l-4 4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </form>

        <div className="mt-2 flex items-center gap-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`rounded-full px-3 py-1 text-[12px] ${
                sort === s.key ? 'bg-gold-500 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-[12px] ${
              filterCount ? 'bg-gold-50 text-gold-700 ring-1 ring-gold-200' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            筛选{filterCount ? `·${filterCount}` : ''}
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden className={filterOpen ? 'rotate-180' : ''}>
              <path d="M3 4.5L6 8l3-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {filterOpen && (
          <div className="mt-2.5 space-y-3 rounded-xl bg-neutral-50 p-3">
            <FilterRow
              label="材质"
              options={[{ id: 0, name: '全部' }, ...materials.map((m) => ({ id: m.id, name: m.name }))]}
              value={materialId}
              onChange={setMaterialId}
            />
            <FilterRow
              label="分类"
              options={[
                { id: 0, name: '全部' },
                ...categories.flatMap((c) => [
                  { id: c.id, name: c.name },
                  ...c.children.map((x) => ({ id: x.id, name: `　${x.name}` })),
                ]),
              ]}
              value={categoryId}
              onChange={setCategoryId}
            />
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCategoryId(0)
                  setMaterialId(0)
                  router.replace('/goods')
                }}
                className="w-full rounded-lg bg-white py-2 text-[12px] text-neutral-500 ring-1 ring-neutral-200"
              >
                清空筛选条件
              </button>
            )}
          </div>
        )}
      </div>

      {(activeCategoryName || activeMaterialName) && (
        <p className="px-3 pt-2.5 text-[12px] text-neutral-400">
          共 {total} 款
          {activeCategoryName ? ` · ${activeCategoryName}` : ''}
          {activeMaterialName ? ` · ${activeMaterialName}` : ''}
        </p>
      )}

      {error && <ErrorBox text={error} onRetry={() => void fetchPage(1, false)} />}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <Empty text="没有找到符合条件的商品" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 p-3">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} mode={mode} />
            ))}
          </div>
          <div ref={sentinel} className="flex justify-center py-4 text-[12px] text-neutral-400">
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <Spinner /> 加载中…
              </span>
            ) : hasMore ? (
              '上拉加载更多'
            ) : (
              `已显示全部 ${total} 款商品`
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ id: number; name: string }>
  value: number
  onChange: (id: number) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`whitespace-pre rounded-md px-2.5 py-1 text-[12px] ${
              value === o.id ? 'bg-gold-500 text-white' : 'bg-white text-neutral-600 ring-1 ring-neutral-200'
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
