/** 复制到剪贴板，兼容不支持 Clipboard API 的微信内置浏览器 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走降级方案
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-1000px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

/** 是否在微信内置浏览器中打开（§2.3：微信内隐藏自定义返回按钮） */
export function isWeixin(): boolean {
  if (typeof navigator === 'undefined') return false
  return /micromessenger/i.test(navigator.userAgent)
}
