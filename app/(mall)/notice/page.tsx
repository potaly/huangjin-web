'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errMsg, qs } from '@/lib/client'
import type { MallNoticeCard, PageResult } from '@/lib/api-types'
import { PageHeader } from '@/components/mall/MallShell'
import { Empty, ErrorBox, Loading } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export default function NoticeListPage() {
  const [items, setItems] = useState<MallNoticeCard[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    api
      .get<PageResult<MallNoticeCard>>(`/api/mall/notices${qs({ pageNum: 1, pageSize: 50 })}`)
      .then((res) => setItems(res.records))
      .catch((e) => setError(errMsg(e)))
  }

  useEffect(load, [])

  return (
    <div>
      <PageHeader title="公告中心" />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!items && !error && <Loading />}
      {items && items.length === 0 && <Empty text="暂无公告" />}

      {items && items.length > 0 && (
        <ul className="space-y-2.5 p-3">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notice/${n.id}`}
                className="flex gap-3 rounded-xl bg-white p-3 shadow-card active:opacity-90"
              >
                {n.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.cover}
                    alt=""
                    loading="lazy"
                    className="h-[62px] w-[88px] shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-[14px] font-medium leading-tight text-neutral-900">
                    {n.isTop && (
                      <span className="mr-1 rounded bg-rose-50 px-1 py-0.5 align-middle text-[10px] font-normal text-rose-600">
                        置顶
                      </span>
                    )}
                    {n.title}
                  </h2>
                  {n.summary && (
                    <p className="mt-1 line-clamp-1 text-[12px] text-neutral-500">{n.summary}</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-neutral-400">{fmtDate(n.publishAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
