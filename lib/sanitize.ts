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

const BLOCK_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'])

interface ParsedTag {
  close: boolean
  name: string
  attrs: string
  end: number // 标签结束位置（'>' 之后）
}

/**
 * 在 pos（必须指向 '<'）处尝试解析一个完整标签。
 * 要求：'<' 后紧跟可选 '/' 与字母；属性区引号外不得再出现 '<'；必须以 '>' 结束。
 * 解析失败返回 null，调用方应把该 '<' 当作普通文本转义。
 */
function parseTagAt(src: string, pos: number): ParsedTag | null {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(src.slice(pos, pos + 64))
  if (!m) return null
  let i = pos + m[0].length
  const attrStart = i
  let quote = ''
  while (i < src.length) {
    const ch = src[i]
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '<') {
      return null
    } else if (ch === '>') {
      return { close: m[1] === '/', name: m[2].toLowerCase(), attrs: src.slice(attrStart, i), end: i + 1 }
    }
    i++
  }
  return null
}

function renderTag(tag: string, attrs: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  let kept = ''
  if (allowed) {
    const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(attrs))) {
      const name = m[1].toLowerCase()
      if (!allowed.has(name)) continue
      // <a> 的 target/rel 由下面统一追加，避免重复净化时累加
      if (tag === 'a' && (name === 'target' || name === 'rel')) continue
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
}

/**
 * 清洗富文本：移除脚本、事件属性、危险协议与未授权标签。
 * 分词式：从左到右扫描，只有完整合法的标签才作为标签输出，
 * 其余 '<' '>' 一律转义为实体，因此删除标签后前后文本不可能拼成新标签。
 */
export function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return ''
  const src = String(input)
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '>') {
      out += '&gt;'
      i++
      continue
    }
    if (ch !== '<') {
      out += ch
      i++
      continue
    }
    // 注释：整段移除；未闭合则按普通文本转义
    if (src.startsWith('<!--', i)) {
      const endIdx = src.indexOf('-->', i + 4)
      if (endIdx >= 0) {
        i = endIdx + 3
        continue
      }
      out += '&lt;'
      i++
      continue
    }
    const tag = parseTagAt(src, i)
    if (!tag) {
      out += '&lt;'
      i++
      continue
    }
    if (BLOCK_TAGS.has(tag.name)) {
      // 整块移除；找不到闭合标签时只移除开始标签本身
      i = tag.end
      if (!tag.close) {
        const closeRe = new RegExp(`<\\s*/\\s*${tag.name}\\s*>`, 'ig')
        closeRe.lastIndex = i
        const cm = closeRe.exec(src)
        if (cm) i = cm.index + cm[0].length
      }
      continue
    }
    i = tag.end
    if (!ALLOWED_TAGS.has(tag.name)) continue
    out += tag.close ? `</${tag.name}>` : renderTag(tag.name, tag.attrs)
  }
  return out
}

function escapeAttr(v: string): string {
  // 已是实体的 & 不再转义，保证重复净化幂等
  return v.replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 富文本转纯文本摘要，用于列表页 */
export function htmlToText(html: string | undefined | null, maxLen = 80): string {
  if (!html) return ''
  const text = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}
