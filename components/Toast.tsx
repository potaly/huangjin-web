'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

interface ToastApi {
  show: (text: string, kind?: ToastKind) => void
  success: (text: string) => void
  error: (text: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let seed = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++seed
    setItems((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (text: string) => show(text, 'success'),
      error: (text: string) => show(text, 'error'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-16 z-[90] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
              t.kind === 'success'
                ? 'bg-emerald-600 text-white ring-emerald-700/20'
                : t.kind === 'error'
                  ? 'bg-rose-600 text-white ring-rose-700/20'
                  : 'bg-neutral-800 text-white ring-black/10'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}
