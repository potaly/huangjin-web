// ────────────────────────────────────────────────────────────────
// 富文本白名单过滤（需求文档 §8.1：富文本输出前做 XSS 过滤）
// 后台录入、前台输出都经过这里，不依赖前端隐藏。
// ────────────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote',
  'img', 'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  img: new Set(['src', 'alt', 'width', 'height']),
  a: new Set(['href', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
}

function safeUrl(value: string): string | null {
  const v = value.trim()
  if (/^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,|\/|#)/i.test(v)) {
    return v
  }
  return null
}

/** 清洗富文本：移除脚本、事件属性、危险协议与未授权标签 */
export function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return ''
  let html = String(input)

  // 整块移除脚本与样式
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
  // 注释
  html = html.replace(/<!--[\s\S]*?-->/g, '')

  // 逐标签过滤
  html = html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_m, close: string, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (close) return `</${tag}>`

    const allowed = ALLOWED_ATTRS[tag]
    let kept = ''
    if (allowed) {
      const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
      let m: RegExpExecArray | null
      while ((m = attrRe.exec(attrs))) {
        const name = m[1].toLowerCase()
        if (!allowed.has(name)) continue
        const value = m[3] ?? m[4] ?? m[5] ?? ''
        if (name === 'src' || name === 'href') {
          const url = safeUrl(value)
          if (!url) continue
          kept += ` ${name}="${escapeAttr(url)}"`
        } else {
          kept += ` ${name}="${escapeAttr(value)}"`
        }
      }
      if (tag === 'a') kept += ' target="_blank" rel="noopener noreferrer"'
    }
    const selfClosing = tag === 'img' || tag === 'br' || tag === 'hr'
    return `<${tag}${kept}${selfClosing ? ' /' : ''}>`
  })

  return html
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 富文本转纯文本摘要，用于列表页 */
export function htmlToText(html: string | undefined | null, maxLen = 80): string {
  if (!html) return ''
  const text = String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}
