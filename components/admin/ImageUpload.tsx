'use client'

import { useRef, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/ui-toast'
import { Spinner } from '@/components/ui'

/** 上传前在浏览器内压缩，控制在后端 600KB 限制内 */
async function compress(file: File, maxSide = 1400, quality = 0.84): Promise<Blob> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  return blob && blob.size < file.size ? blob : file
}

export function ImageUpload({
  value,
  onChange,
  label = '上传图片',
  aspect = 'aspect-square',
  className = '',
}: {
  value?: string
  onChange: (url: string) => void
  label?: string
  aspect?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const blob = await compress(file)
      const form = new FormData()
      form.append(
        'file',
        new File([blob], file.name.replace(/\.[^.]+$/, blob.type === 'image/jpeg' ? '.jpg' : ''), {
          type: blob.type || file.type,
        }),
      )
      const res = await api.upload<{ url: string }>('/api/admin/upload', form)
      onChange(res.url)
      toast.success('上传成功')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <div className={`relative w-28 overflow-hidden rounded-lg ring-1 ring-neutral-200 ${aspect}`}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="移除图片"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-50 text-[11px] text-neutral-400 hover:bg-neutral-100"
          >
            {busy ? (
              <Spinner />
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
            {busy ? '上传中' : label}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void pick(file)
        }}
      />

      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="或直接粘贴图片地址"
        className="mt-1.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[12px] outline-none focus:border-gold-400"
      />
    </div>
  )
}

/** 多图上传，最多 9 张（§5.1 轮播图）*/
export function ImagesUpload({
  value,
  onChange,
  max = 9,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  max?: number
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {value.map((url, i) => (
        <div key={`${url}-${i}`} className="relative h-24 w-24 overflow-hidden rounded-lg ring-1 ring-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            aria-label="移除"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          {i > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = [...value]
                ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                onChange(next)
              }}
              aria-label="前移"
              className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white"
            >
              ←
            </button>
          )}
        </div>
      ))}
      {value.length < max && (
        <ImageUpload
          value=""
          onChange={(url) => url && onChange([...value, url])}
          label={`添加 (${value.length}/${max})`}
          className="w-28"
        />
      )}
    </div>
  )
}
