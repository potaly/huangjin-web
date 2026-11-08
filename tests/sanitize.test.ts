import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeHtml, htmlToText } from '../lib/sanitize'

const EDITOR =
  '<p><strong>x</strong></p><h2>y</h2><ol><li>a</li></ol><ul><li>b</li></ul>' +
  '<p><img src="https://xiaojing.keyseal.top/api/files/abc" width="100%"></p><p><br></p>'

/** 输出中不得出现任何危险标签或事件属性（作为标签） */
function assertSafe(out: string) {
  assert.ok(!/<\s*\/?\s*script/i.test(out), `含 script 标签: ${out}`)
  assert.ok(!/<[^>]*\bon\w+\s*=/i.test(out), `含事件属性: ${out}`)
  assert.ok(!/<\s*(iframe|object|embed|style|link|meta)\b/i.test(out), `含危险标签: ${out}`)
  assert.ok(!/<[^>]*javascript:/i.test(out), `含 javascript: ${out}`)
}

function assertStable(input: string) {
  const once = sanitizeHtml(input)
  const twice = sanitizeHtml(once)
  assertSafe(once)
  assertSafe(twice)
  assert.equal(twice, once, `不幂等: ${input}`)
}

test('拼接绕过 payload 1：<<x>script>', () => {
  const once = sanitizeHtml('<<x>script>alert(1)<<x>/script>')
  assertSafe(once)
  assert.ok(!/<script/i.test(once))
  assertSafe(sanitizeHtml(once))
})

test('拼接绕过 payload 2：<<<x>x>img onerror', () => {
  const once = sanitizeHtml('<<<x>x>img src=x onerror=alert(1)>')
  assertSafe(once)
  assert.ok(!/<img/i.test(once))
  assert.ok(!/<img/i.test(sanitizeHtml(once)))
})

test('多层嵌套与变形', () => {
  const cases = [
    '<scr<x>ipt>alert(1)</scr<x>ipt>',
    '<img/src=x/onerror=alert(1)>',
    '<ScRiPt>alert(1)</sCrIpT>',
    '<SCRIPT\n>alert(1)</SCRIPT\n>',
    '<img\nsrc=x\nonerror=alert(1)\n>',
    '<<<<script>>>>alert(1)<<<</script>>>>',
    '<sc<!-- -->ript>alert(1)</sc<!-- -->ript>',
    '<<script>script>alert(1)</script>',
    '<<a>img src=x onerror=alert(1)>',
    '<scr<script></script>ipt>alert(1)</scr<script></script>ipt>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="x" <b>onclick=alert(1)>t</a>',
  ]
  for (const c of cases) assertStable(c)
})

test('script/style 整块移除，注释移除', () => {
  assert.equal(sanitizeHtml('a<script>alert(1)</script>b'), 'ab')
  assert.equal(sanitizeHtml('a<style>p{}</style>b<!-- c -->d'), 'abd')
  assert.equal(sanitizeHtml('<iframe src="x"></iframe>ok'), 'ok')
})

test('事件属性与 javascript: 链接被移除', () => {
  const a = sanitizeHtml('<a href="javascript:alert(1)" onclick="alert(2)">x</a>')
  assertSafe(a)
  assert.ok(!/javascript/i.test(a))
  const i = sanitizeHtml('<img src="https://a.com/1.png" onerror="alert(1)" onload=alert(2)>')
  assert.equal(i, '<img src="https://a.com/1.png" />')
  const b = sanitizeHtml('<a href=" JavaScript:alert(1)">x</a>')
  assert.ok(!/javascript/i.test(b))
})

test('<a> 追加 target/rel 且二次净化幂等', () => {
  const once = sanitizeHtml('<a href="https://a.com/x?a=1&b=2">t</a>')
  assert.equal(once, '<a href="https://a.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">t</a>')
  assert.equal(sanitizeHtml(once), once)
})

test('微信 editor 典型输出不被破坏且幂等', () => {
  const once = sanitizeHtml(EDITOR)
  assert.equal(once, EDITOR.replace('width="100%">', 'width="100%" />').replace('<br>', '<br />'))
  assert.equal(sanitizeHtml(once), once)
})

test('普通文本中的 < 与 > 被转义而不是吞掉', () => {
  assert.equal(sanitizeHtml('克重 < 5'), '克重 &lt; 5')
  assert.equal(sanitizeHtml('<p>a < b && c > d</p>'), '<p>a &lt; b && c &gt; d</p>')
  assert.equal(sanitizeHtml('1<2'), '1&lt;2')
  assert.equal(sanitizeHtml('末尾 <'), '末尾 &lt;')
  assert.equal(sanitizeHtml('<p>未闭合 <b'), '<p>未闭合 &lt;b')
  assertStable('克重 < 5 > 3')
})

test('未授权标签被移除但内容保留', () => {
  assert.equal(sanitizeHtml('<font color="red">x</font>'), 'x')
})

test('二次净化不产生 <script 或 onerror=', () => {
  const payloads = [
    '<<x>script>alert(1)<<x>/script>',
    '<<<x>x>img src=x onerror=alert(1)>',
    '<scr<x>ipt>alert(1)</scr<x>ipt>',
    '<img/src=x/onerror=alert(1)>',
  ]
  for (const p of payloads) {
    let s = p
    for (let i = 0; i < 4; i++) {
      s = sanitizeHtml(s)
      assert.ok(!/<script/i.test(s), s)
      assert.ok(!/<[^>]*onerror\s*=/i.test(s), s)
    }
  }
})

test('htmlToText', () => {
  assert.equal(htmlToText('<p>a&nbsp;b</p><p>c &lt; d</p>'), 'a bc < d')
  assert.equal(htmlToText('克重 < 5 且 7 > 3'), '克重 < 5 且 7 > 3')
  assert.equal(htmlToText('1234567890', 5), '12345…')
  assert.equal(htmlToText(null), '')
})
