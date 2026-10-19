'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Spinner } from '@/components/ui'

/** 后台页面标题栏 */
export function PageTitle({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        {desc && <p className="mt-0.5 text-[13px] text-neutral-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-card ring-1 ring-neutral-100 ${className}`}>
      {children}
    </section>
  )
}

/** 查询条件栏 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-card ring-1 ring-neutral-100">
      {children}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  required,
  className = '',
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[13px] text-neutral-600">
        {required && <span className="mr-0.5 text-rose-500">*</span>}
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13.5px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-100 disabled:bg-neutral-50'

export const selectCls = `${inputCls} appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 8l3-3.5' fill='none' stroke='%239aa0a6' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8`

/** 表格 */
export function Table({
  columns,
  children,
  empty,
  loading,
}: {
  columns: Array<{ key: string; label: string; width?: string; align?: 'left' | 'right' | 'center' }>
  children: ReactNode
  empty?: boolean
  loading?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-card ring-1 ring-neutral-100">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-neutral-500">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={`whitespace-nowrap px-3 py-2.5 font-medium ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-neutral-400">
                <span className="inline-flex items-center gap-2">
                  <Spinner /> 加载中…
                </span>
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-neutral-400">
                暂无数据
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Td({
  children,
  align,
  className = '',
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <td
      className={`px-3 py-2.5 align-middle ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}

/** 分页器 */
export function Pager({
  pageNum,
  pageSize,
  total,
  onChange,
}: {
  pageNum: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  return (
    <div className="mt-3 flex items-center justify-between text-[13px] text-neutral-500">
      <span>
        共 {total} 条 · 第 {pageNum}/{pages} 页
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={pageNum <= 1} onClick={() => onChange(pageNum - 1)}>
          上一页
        </Button>
        <Button variant="ghost" size="sm" disabled={pageNum >= pages} onClick={() => onChange(pageNum + 1)}>
          下一页
        </Button>
      </div>
    </div>
  )
}

/** 居中弹窗 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true">
      <button type="button" aria-label="关闭" onClick={onClose} className="fixed inset-0 bg-black/40" />
      <div className={`relative z-10 w-full ${width} my-auto rounded-xl bg-white shadow-2xl`}>
        <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-neutral-100 px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  )
}

/** 确认对话框 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    text: string
    danger: boolean
    resolve?: (v: boolean) => void
  }>({ open: false, title: '', text: '', danger: false })

  const confirm = (text: string, opts?: { title?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: opts?.title ?? '请确认',
        text,
        danger: opts?.danger ?? false,
        resolve,
      })
    })

  const close = (result: boolean) => {
    state.resolve?.(result)
    setState((s) => ({ ...s, open: false, resolve: undefined }))
  }

  const dialog = (
    <Modal
      open={state.open}
      onClose={() => close(false)}
      title={state.title}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            取消
          </Button>
          <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            确定
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-neutral-700">{state.text}</p>
    </Modal>
  )

  return { confirm, dialog }
}

/** 开关 */
export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-gold-500' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function StatusDot({ on, onText = '启用', offText = '停用' }: { on: boolean; onText?: string; offText?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${on ? 'text-emerald-600' : 'text-neutral-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
      {on ? onText : offText}
    </span>
  )
}

/** 防抖输入，用于列表搜索 */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
