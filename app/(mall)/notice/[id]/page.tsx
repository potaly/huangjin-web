'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, errMsg } from '@/lib/client'
import type { MallNoticeDetail } from '@/lib/api-types'
import { PageHeader } from '@/components/mall/MallShell'
import { ErrorBox, Loading } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>()
  const [notice, setNotice] = useState<MallNoticeDetail | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    api
      .get<MallNoticeDetail>(`/api/mall/notices/${params.id}`)
      .then(setNotice)
      .catch((e) => setError(errMsg(e)))
  }

  useEffect(load, [params.id])

  return (
    <div>
      <PageHeader title="公告详情" />

      {error && <ErrorBox text={error} onRetry={load} />}
      {!notice && !error && <Loading />}

      {notice && (
        <article className="bg-white px-4 pb-10 pt-4">
          <h1 className="text-[19px] font-semibold leading-snug text-neutral-900">{notice.title}</h1>
          <p className="mt-2 border-b border-neutral-100 pb-3 text-[12px] text-neutral-400">
            发布时间 {fmtDateTime(notice.publishAt)}
          </p>
          {notice.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={notice.cover} alt="" className="mt-4 w-full rounded-xl object-cover" />
          )}
          <div
            className="rich-text mt-4"
            // 内容已在服务端经 sanitizeHtml 白名单过滤（§8.1）
            dangerouslySetInnerHTML={{ __html: notice.contentHtml }}
          />
        </article>
      )}
    </div>
  )
}
