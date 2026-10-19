'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, errMsg } from '@/lib/client'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui'
import { inputCls } from '@/components/admin/AdminUI'

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-100" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaSrc, setCaptchaSrc] = useState('/api/admin/auth/captcha')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const refreshCaptcha = useCallback(() => {
    setCaptcha('')
    setCaptchaSrc(`/api/admin/auth/captcha?t=${Date.now()}`)
  }, [])

  useEffect(refreshCaptcha, [refreshCaptcha])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/admin/auth/login', { username, password, captcha })
      const from = searchParams.get('from')
      router.replace(from && from.startsWith('/admin') ? from : '/admin')
    } catch (err) {
      toast.error(errMsg(err))
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-100 via-neutral-50 to-gold-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500 text-lg font-bold text-white">
            金
          </span>
          <h1 className="text-xl font-semibold text-neutral-900">黄金首饰批发商城</h1>
          <p className="mt-1 text-[13px] text-neutral-500">管理后台 · 一期</p>
        </div>

        <form onSubmit={submit} className="space-y-3.5 rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutral-100">
          <label className="block">
            <span className="mb-1 block text-[13px] text-neutral-600">用户名</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className={inputCls}
              placeholder="请输入用户名"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] text-neutral-600">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputCls}
              placeholder="请输入密码"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] text-neutral-600">验证码</span>
            <div className="flex gap-2">
              <input
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                required
                maxLength={4}
                className={`${inputCls} flex-1 uppercase tracking-widest`}
                placeholder="4 位字符"
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                title="点击刷新验证码"
                className="h-[38px] w-[120px] shrink-0 overflow-hidden rounded-lg ring-1 ring-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captchaSrc} alt="点击刷新验证码" className="h-full w-full object-cover" />
              </button>
            </div>
          </label>

          <Button type="submit" loading={loading} className="w-full py-2.5">
            登录
          </Button>

          <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] leading-relaxed text-neutral-500">
            演示账号：
            <br />
            超管 <code className="text-neutral-700">admin / admin123456</code>
            <br />
            运营 <code className="text-neutral-700">operator / operator123</code>
            <br />
            仓库 <code className="text-neutral-700">warehouse / warehouse123</code>
          </p>
        </form>

        <p className="mt-4 text-center text-[12px] text-neutral-400">
          <a href="/" className="hover:text-gold-600">
            ← 返回前台商城
          </a>
        </p>
      </div>
    </div>
  )
}
