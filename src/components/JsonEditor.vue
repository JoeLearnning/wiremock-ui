<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'

const props = defineProps<{
  modelValue: string
  bodyType?: 'json' | 'xml' | 'text' | 'html' | 'base64'
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const bodyType = computed(() => props.bodyType || 'json')

const editorRef = ref<HTMLTextAreaElement | null>(null)
const highlighterRef = ref<HTMLPreElement | null>(null)
const localValue = ref(props.modelValue)
const error = ref('')
const lineCount = ref(1)

watch(() => props.modelValue, (val) => {
  localValue.value = val
  updateLineCount()
  validate()
})

function updateLineCount() {
  lineCount.value = (localValue.value.match(/\n/g) || []).length + 1
}

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  localValue.value = target.value
  emit('update:modelValue', target.value)
  updateLineCount()
  validate()
}

// ── JSON 格式化 ──
function formatJson(text: string): string {
  const obj = JSON.parse(text)
  return JSON.stringify(obj, null, 2)
}

// ── XML / HTML 格式化 ──
function formatXml(text: string): string {
  let xml = text.trim()
  // 去掉 >< 之间的空白
  xml = xml.replace(/>\s+</g, '><')
  // 把自闭合标签补全 <tag/> → <tag />
  xml = xml.replace(/<(\w[^>]*?)\/>/g, '<$1 />')

  const lines: string[] = []
  let indent = 0
  const tab = '  '
  // 按标签和文本分割——保留空行以确保行号对齐
  const parts = xml.replace(/(<[^>]+>)/g, '\n$1\n').split('\n')

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) {
      // 保留空行占位，否则格式化后行号偏移
      lines.push('')
      continue
    }

    // 判断是否结束标签 </tag>
    const isEndTag = /^<\//.test(trimmed)
    // 判断是否自闭合标签 <tag ... />
    const isSelfClose = /\/>$/.test(trimmed)
    // 判断是否处理指令或注释 <? ... ?> / <!-- ... -->
    const isSpecial = /^<\?/.test(trimmed) || /^<!--/.test(trimmed)

    if (isEndTag) {
      indent = Math.max(0, indent - 1)
    }

    lines.push(tab.repeat(indent) + trimmed)

    if (!isEndTag && !isSelfClose && !isSpecial) {
      indent++
    }
  }

  return lines.join('\n')
}

// ── 文本格式化（简单清理） ──
function formatText(text: string): string {
  return text.trim()
}

// ── Base64 格式化（当前仅验证，不做格式化） ──
function formatBase64(text: string): string {
  // 去掉空白字符
  return text.trim()
}

function format() {
  try {
    const bt = bodyType.value
    if (bt === 'json') {
      localValue.value = formatJson(localValue.value)
    } else if (bt === 'xml' || bt === 'html') {
      localValue.value = formatXml(localValue.value)
    } else if (bt === 'text') {
      localValue.value = formatText(localValue.value)
    } else if (bt === 'base64') {
      localValue.value = formatBase64(localValue.value)
    }
    error.value = ''
    updateLineCount()
    emit('update:modelValue', localValue.value)
  } catch (e: any) {
    error.value = e.message
    MessagePlugin.warning('Format failed: ' + (e.message || 'invalid content'))
  }
}

function copyContent() {
  const text = localValue.value
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    MessagePlugin.success('已复制')
  }).catch(() => {
    // fallback: 选中 textarea 内容
    const ta = editorRef.value
    if (ta) { ta.select(); document.execCommand('copy'); MessagePlugin.success('已复制') }
  })
}

function clearContent() {
  localValue.value = ''
  emit('update:modelValue', '')
  error.value = ''
  updateLineCount()
}

function validate() {
  if (!localValue.value.trim()) { error.value = ''; return }
  const bt = bodyType.value
  try {
    if (bt === 'json') {
      JSON.parse(localValue.value)
    } else if (bt === 'xml' || bt === 'html') {
      // 简单检查标签闭合 —— 只检测明显错误
    } else if (bt === 'base64') {
      // 验证是否为合法 base64
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(localValue.value.trim())) {
        throw new Error('非法 Base64 字符')
      }
    }
    error.value = ''
  } catch (e: any) {
    error.value = e.message
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const ta = editorRef.value
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    localValue.value = localValue.value.substring(0, start) + '  ' + localValue.value.substring(end)
    emit('update:modelValue', localValue.value)
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') { e.preventDefault(); format() }
}

function syncScroll() {
  if (editorRef.value && highlighterRef.value) {
    highlighterRef.value.scrollTop = editorRef.value.scrollTop
    highlighterRef.value.scrollLeft = editorRef.value.scrollLeft
  }
}

// ── JSON 语法高亮 ──
function highlightJson(text: string): string {
  if (!text) return ''
  const result: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      const start = i; i++
      while (i < text.length) { if (text[i] === '\\') { i += 2; continue }; if (text[i] === '"') { i++; break }; i++ }
      const str = text.slice(start, i)
      const after = text.slice(i).match(/^\s*:/)
      const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (after) result.push('<span class="hl-key">' + escaped + '</span>')
      else result.push('<span class="hl-string">' + escaped + '</span>')
    } else if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      result.push('<span class="hl-brace">' + ch + '</span>'); i++
    } else if (ch === ':') { result.push('<span class="hl-punc">:</span>'); i++ }
    else if (ch === ',') { result.push('<span class="hl-punc">,</span>'); i++ }
    else if (/\d/.test(ch) || (ch === '-' && /\d/.test(text[i + 1] || ''))) {
      const start = i; if (text[i] === '-') i++
      while (i < text.length && /\d/.test(text[i])) i++
      if (text[i] === '.') { i++; while (i < text.length && /\d/.test(text[i])) i++ }
      if (text[i] === 'e' || text[i] === 'E') { i++; if (text[i] === '+' || text[i] === '-') i++; while (i < text.length && /\d/.test(text[i])) i++ }
      result.push('<span class="hl-number">' + text.slice(start, i) + '</span>')
    } else if (text.slice(i).startsWith('true')) { result.push('<span class="hl-bool">true</span>'); i += 4 }
    else if (text.slice(i).startsWith('false')) { result.push('<span class="hl-bool">false</span>'); i += 5 }
    else if (text.slice(i).startsWith('null')) { result.push('<span class="hl-null">null</span>'); i += 4 }
    else { const esc = text[i] === '&' ? '&amp;' : text[i] === '<' ? '&lt;' : text[i] === '>' ? '&gt;' : text[i]; result.push(esc); i++ }
  }
  return result.join('')
}

// ── XML / HTML 语法高亮（单遍扫描，避免正则链嵌套问题） ──
function highlightXml(text: string): string {
  if (!text) return ''
  // 先对整个文本做 HTML 转义，后续只操作已转义文本，确保 v-html 不会误解析
  const s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const out: string[] = []
  let i = 0

  while (i < s.length) {
    // 注释 <!-- ... -->
    if (s.startsWith('&lt;!--', i)) {
      const end = s.indexOf('--&gt;', i + 7)
      if (end !== -1) {
        out.push('<span class="hl-comment">' + s.slice(i, end + 6) + '</span>')
        i = end + 6
        continue
      }
    }
    // 处理指令 <? ... ?>
    if (s.startsWith('&lt;?', i)) {
      const end = s.indexOf('?&gt;', i + 4)
      if (end !== -1) {
        out.push('<span class="hl-comment">' + s.slice(i, end + 4) + '</span>')
        i = end + 4
        continue
      }
    }
    // 结束标签 </tag>
    if (s.startsWith('&lt;/', i)) {
      const tagStart = i + 4
      const tagEnd = scanTagName(s, tagStart)
      if (tagEnd > tagStart) {
        const gtEnd = s.indexOf('&gt;', tagEnd)
        if (gtEnd !== -1) {
          out.push('&lt;/<span class="hl-tag">' + s.slice(tagStart, tagEnd) + '</span>&gt;')
          i = gtEnd + 4
          continue
        }
      }
    }
    // 开始标签 <tag ...>
    if (s.startsWith('&lt;', i)) {
      const gtEnd = s.indexOf('&gt;', i + 4)
      if (gtEnd !== -1) {
        const tagContent = s.slice(i + 4, gtEnd) // 标签名+属性（已转义）
        const nameMatch = tagContent.match(/^([\w.-]+)/)
        if (nameMatch) {
          const tagName = nameMatch[0]
          const afterName = tagContent.slice(tagName.length)
          const isSelfClose = /\/\s*$/.test(tagContent)
          const closeSlash = isSelfClose ? '/' : ''
          out.push('&lt;<span class="hl-tag">' + tagName + '</span>')
          out.push(highlightXmlAttrs(afterName))
          out.push(closeSlash + '&gt;')
          i = gtEnd + 4
          continue
        }
      }
    }
    // 普通文本 — 直接原样输出（已在 s 中完成转义）
    out.push(s[i])
    i++
  }

  return out.join('')
}

// 扫描标签名（字母开头，含字母数字 . -）
function scanTagName(s: string, start: number): number {
  let i = start
  while (i < s.length && /[\w.-]/.test(s[i])) i++
  return i
}

// 高亮标签属性（在标签名之后、&gt; 之前的内容；输入的 attrStr 已 HTML 转义）
function highlightXmlAttrs(attrStr: string): string {
  if (!attrStr.trim()) return ''
  const out: string[] = []
  let i = 0
  while (i < attrStr.length) {
    if (/^\s/.test(attrStr[i])) { out.push(attrStr[i]); i++; continue }
    const nameMatch = attrStr.slice(i).match(/^([\w:-]+)/)
    if (!nameMatch) { out.push(attrStr[i]); i++; continue }
    const name = nameMatch[1]
    i += name.length
    while (i < attrStr.length && /^\s/.test(attrStr[i])) { out.push(attrStr[i]); i++ }
    if (attrStr[i] === '=') {
      out.push('=')
      i++
      if (i < attrStr.length && (attrStr[i] === '"' || attrStr.startsWith('&quot;', i))) {
        const isEntity = attrStr.startsWith('&quot;', i)
        const qLen = isEntity ? 6 : 1
        const endQ = isEntity ? '&quot;' : '"'
        const valStart = i + qLen
        const valEnd = attrStr.indexOf(endQ, valStart)
        if (valEnd !== -1) {
          const val = attrStr.slice(valStart, valEnd)
          const opening = attrStr.slice(i, i + qLen)
          out.push('<span class="hl-attr">' + name + '</span>' + opening + '<span class="hl-string">' + val + '</span>' + endQ)
          i = valEnd + qLen
          continue
        }
      }
      out.push('<span class="hl-attr">' + name + '</span>=')
    } else {
      out.push('<span class="hl-attr">' + name + '</span>')
    }
  }
  return out.join('')
}

// HTML 转义（只转义 & < >，因为其余字符在 v-html 中安全）
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── 通用文本高亮（无高亮，只做转义） ──
function highlightPlain(text: string): string {
  return text ? escHtml(text) : ''
}

const highlightedHtml = computed(() => {
  const bt = bodyType.value
  const text = localValue.value
  if (bt === 'json') return highlightJson(text)
  if (bt === 'xml' || bt === 'html') return highlightXml(text)
  return highlightPlain(text)
})

const formatLabel = computed(() => {
  const bt = bodyType.value
  const map: Record<string, string> = { json: 'JSON', xml: 'XML', text: 'TEXT', html: 'HTML', base64: 'BASE64' }
  return map[bt] || 'JSON'
})

// Line numbers
const lineNumbers = ref<string[]>([])
watch(lineCount, () => {
  lineNumbers.value = Array.from({ length: lineCount.value }, (_, i) => String(i + 1))
})
onMounted(() => {
  lineNumbers.value = Array.from({ length: lineCount.value }, (_, i) => String(i + 1))
})
</script>

<template>
  <div class="json-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-hint">{{ formatLabel }}</span>
        <span v-if="error" class="error-indicator" :title="error">⚠ Syntax Error</span>
      </div>
      <div class="toolbar-right">
        <t-button size="small" variant="text" @click="format" title="Format (Ctrl+Shift+F)">
          <template #icon><t-icon name="format" /></template>
          Format
        </t-button>
        <t-button size="small" variant="text" @click="clearContent" title="Clear">Clear</t-button>
        <t-button size="small" variant="text" @click="copyContent" title="Copy">
          <template #icon><t-icon name="file-copy" /></template>
        </t-button>
      </div>
    </div>
    <div class="editor-body">
      <div class="line-numbers">
        <div v-for="ln in lineNumbers" :key="ln" class="line-num">{{ ln }}</div>
      </div>
      <div class="code-area">
        <pre ref="highlighterRef" class="highlight-layer" v-html="highlightedHtml" />
        <textarea
          ref="editorRef"
          class="editor-textarea"
          :value="localValue"
          spellcheck="false"
          @input="onInput"
          @scroll="syncScroll"
          @keydown="handleKeydown"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-editor {
  width: 100%;
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.json-editor.flex-1 { flex: 1; min-height: 0; }

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--td-bg-color-page);
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-hint { font-size: 12px; font-weight: 600; color: var(--td-text-color-placeholder); }
.error-indicator { font-size: 12px; color: var(--td-error-color); cursor: help; }

.editor-body {
  display: flex;
  flex: 1;
  min-height: 150px;
  overflow: hidden;
}

.line-numbers {
  padding: 10px 0;
  background: #1e1e1e;
  border-right: 1px solid #333;
  user-select: none;
  text-align: right;
  min-width: 48px;
  flex-shrink: 0;
  overflow: hidden;
}
.line-num {
  padding: 0 12px;
  font-size: 14px;
  line-height: 21px;
  color: #858585;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
}

.code-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #1e1e1e;
}

.highlight-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  margin: 0;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 21px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  pointer-events: none;
  color: #d4d4d4;
  tab-size: 2;
}

.editor-textarea {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  border: none;
  outline: none;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 21px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
  resize: none;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-all;
  background: transparent;
  color: transparent;
  caret-color: #fff;
  overflow: auto;
}
.editor-textarea::selection { background: rgba(38, 79, 120, 0.6); }

/* VS Code Dark 配色 — JSON */
.code-area :deep(.hl-key)    { color: #9cdcfe; }
.code-area :deep(.hl-string)  { color: #ce9178; }
.code-area :deep(.hl-number)  { color: #b5cea8; }
.code-area :deep(.hl-bool)    { color: #569cd6; }
.code-area :deep(.hl-null)    { color: #569cd6; }
.code-area :deep(.hl-brace)   { color: #da70d6; }
.code-area :deep(.hl-punc)    { color: #d4d4d4; }

/* XML / HTML 配色 */
.code-area :deep(.hl-tag)     { color: #569cd6; }
.code-area :deep(.hl-attr)    { color: #9cdcfe; }
.code-area :deep(.hl-comment) { color: #6a9955; }

/* 滚动条 */
.code-area ::-webkit-scrollbar { width: 10px; height: 10px; }
.code-area ::-webkit-scrollbar-track { background: transparent; }
.code-area ::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.4); border-radius: 4px; }
.code-area ::-webkit-scrollbar-thumb:hover { background: rgba(100,100,100,0.6); }
</style>
