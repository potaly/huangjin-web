'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errMsg } from '@/lib/client'
import type { MallCategoryNode } from '@/lib/api-types'
import { Empty, ErrorBox, Loading } from '@/components/ui'

export default function CategoryPage() {
  const [tree, setTree] = useState<MallCategoryNode[] | null>(null)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)

  const load = () => {
    setError('')
    api
      .get<MallCategoryNode[]>('/api/mall/categories')
      .then((res) => {
        setTree(res)
        setActiveId(res[0]?.id ?? null)
      })
      .catch((e) => setError(errMsg(e)))
  }

  useEffect(load, [])

  const active = tree?.find((c) => c.id === activeId) ?? null

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white px-3 py-3">
        <h1 className="text-[16px] font-semibold text-neutral-900">商品分类</h1>
      </header>

      {error && <ErrorBox text={error} onRetry={load} />}
      {!tree && !error && <Loading />}

      {tree && tree.length === 0 && <Empty text="还没有配置分类" />}

      {tree && tree.length > 0 && (
        <div className="flex min-h-[calc(100vh-108px)]">
          {/* 左侧一级分类 */}
          <nav className="w-[96px] shrink-0 border-r border-neutral-100 bg-neutral-50">
            {tree.map((c) => {
              const on = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`relative block w-full px-2 py-3.5 text-[13px] leading-tight ${
                    on ? 'bg-white font-medium text-gold-700' : 'text-neutral-600'
                  }`}
                >
                  {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold-500" />}
                  {c.name}
                </button>
              )
            })}
          </nav>

          {/* 右侧二级分类 */}
          <div className="min-w-0 flex-1 p-3">
            {active && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[14px] font-medium text-neutral-800">{active.name}</h2>
                  <Link
                    href={`/goods?categoryId=${active.id}`}
                    className="text-[12px] text-gold-600"
                  >
                    查看全部 {active.productCount} 款 ›
                  </Link>
                </div>

                {active.children.length === 0 ? (
                  <Link
                    href={`/goods?categoryId=${active.id}`}
                    className="flex items-center justify-center rounded-xl bg-gold-50 py-8 text-[13px] text-gold-700 ring-1 ring-gold-100"
                  >
                    浏览「{active.name}」全部款式
                  </Link>
                ) : (
                  <ul className="grid grid-cols-3 gap-2.5">
                    {active.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/goods?categoryId=${child.id}`}
                          className="flex h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl bg-neutral-50 px-1 text-center active:bg-neutral-100"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-100 text-[13px] text-gold-700">
                            {child.name.slice(0, 1)}
                          </span>
                          <span className="line-clamp-2 text-[11px] leading-tight text-neutral-700">
                            {child.name}
                          </span>
                          <span className="text-[10px] text-neutral-400">{child.productCount} 款</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
