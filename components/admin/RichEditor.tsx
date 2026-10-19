'use client'

import { useEffect, useRef, useState } from 'react'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'

/**
 * 轻量富文本编辑器（contenteditable + execCommand）
 * 用于公告正文与商品详情；内容保存时由后端 sanitizeHtml 白名单过滤。
 */
export function RichEditor({
  value,
  onChange,
  placeholder = '请输入内容…',
  minHeight = 200,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [source, setSource] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // 仅在外部值与当前 DOM 不一致时回写，避免打断输入
  useEffect(() => {
    const el = ref.current
    if (el && !source && el.innerHTML !== value) el.innerHTML = value || ''
  }, [value, source])

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }

  const insertImage = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<{ url: string }>('/api/admin/upload', form)
      exec('insertHTML', `<img src="${res.url}" alt="" />`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const TOOLS: Array<[string, string, () => void]> = [
    ['B', '加粗', () => exec('bold')],
    ['I', '斜体', () => exec('italic')],
    ['U', '下划线', () => exec('underline')],
    ['H2', '标题', () => exec('formatBlock', '<h3>')],
    ['P', '正文', () => exec('formatBlock', '<p>')],
    ['• 列表', '无序列表', () => exec('insertUnorderedList')],
    ['1. 列表', '有序列表', () => exec('insertOrderedList')],
    ['引用', '引用块', () => exec('formatBlock', '<blockquote>')],
    ['分隔线', '插入分隔线', () => exec('insertHorizontalRule')],
    ['清除格式', '清除格式', () => exec('removeFormat')],
  ]

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-gold-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-100 bg-neutral-50 px-2 py-1.5">
        {!source &&
          TOOLS.map(([label, title, action]) => (
            <button
              key={label}
              type="button"
              title={title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={action}
              className="rounded px-1.5 py-1 text-[12px] text-neutral-600 hover:bg-white hover:text-neutral-900"
            >
              {label}
            </button>
          ))}
        {!source && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded px-1.5 py-1 text-[12px] text-neutral-600 hover:bg-white hover:text-neutral-900 disabled:opacity-50"
          >
            {uploading ? '上传中…' : '插入图片'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setSource((v) => !v)}
          className="ml-auto rounded px-1.5 py-1 text-[12px] text-gold-700 hover:bg-white"
        >
          {source ? '可视化编辑' : '编辑 HTML'}
        </button>
      </div>

      {source ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight }}
          className="block w-full resize-y px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none"
          placeholder="<p>HTML 源码</p>"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          style={{ minHeight }}
          className="rich-text block px-3 py-2.5 outline-none"
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void insertImage(file)
        }}
      />
    </div>
  )
}
