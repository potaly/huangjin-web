'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { StockLevel } from '@/lib/types'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-400">
      <Spinner /> {text}
    </div>
  )
}

export function Empty({ text = '暂无数据', action }: { text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
        <rect x="8" y="14" width="40" height="30" rx="5" stroke="#d6d8dc" strokeWidth="2.5" />
        <path d="M8 24h40" stroke="#d6d8dc" strokeWidth="2.5" />
        <circle cx="19" cy="19" r="1.8" fill="#d6d8dc" />
        <path d="M20 34h16" stroke="#e3e5e8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-neutral-400">{text}</p>
      {action}
    </div>
  )
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-8 rounded-xl bg-rose-50 p-5 text-center ring-1 ring-rose-100">
      <p className="text-sm text-rose-700">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-sm text-white active:bg-rose-700"
        >
          重新加载
        </button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  size?: 'sm' | 'md'
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold-500 text-white hover:bg-gold-600 active:bg-gold-700 disabled:bg-gold-200',
  ghost: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
  outline: 'bg-white text-gold-700 ring-1 ring-gold-300 hover:bg-gold-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
}

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

const LEVEL_STYLE: Record<StockLevel, string> = {
  ENOUGH: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  LOW: 'bg-amber-50 text-amber-700 ring-amber-100',
  SOLD_OUT: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
}

const LEVEL_TEXT: Record<StockLevel, string> = {
  ENOUGH: '充足',
  LOW: '少量',
  SOLD_OUT: '售罄',
}

export function StockBadge({ level, className = '' }: { level: StockLevel; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${LEVEL_STYLE[level]} ${className}`}
    >
      {LEVEL_TEXT[level]}
    </span>
  )
}

export function Tag({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue'
  className?: string
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600',
    gold: 'bg-gold-50 text-gold-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

/** 底部弹起的面板，移动端常见交互 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative z-10 w-full max-w-shell rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-neutral-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
            aria-label="关闭"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}
