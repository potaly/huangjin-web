'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, errMsg, MALL_TOKEN_KEY } from '@/lib/client'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f3ee]" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const redirect = useSearchParams().get('redirect') || '/'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^1\d{10}$/.test(phone.trim())) {
      setError('请输入 11 位手机号')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ token: string }>('/api/mall/auth/phone-login', { phone: phone.trim() })
      localStorage.setItem(MALL_TOKEN_KEY, res.token)
      router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-shell flex-col bg-[#f6f3ee] px-6 pt-24">
      <h1 className="text-[22px] font-semibold text-champagne-ink">凡晟珠宝</h1>
      <p className="mt-1 text-[13px] text-champagne-sub">仅限店铺授权客户使用，请用登记的手机号登录</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError('') }}
          inputMode="numeric"
          maxLength={11}
          placeholder="手机号"
          className="h-12 w-full rounded-xl bg-white px-4 text-[15px] outline-none ring-1 ring-neutral-200 focus:ring-gold-500"
        />
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-gold-500 text-[15px] font-medium text-white active:bg-gold-600 disabled:opacity-60"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-neutral-400">没有开通？请联系店家添加您的手机号</p>
    </div>
  )
}
