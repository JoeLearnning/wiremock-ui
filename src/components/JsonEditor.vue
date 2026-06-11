<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editorRef = ref<HTMLTextAreaElement | null>(null)
const highlighterRef = ref<HTMLPreElement | null>(null)
const localValue = ref(props.modelValue)
const error = ref('')
const lineCount = ref(1)

watch(() => props.modelValue, (val) => {
  localValue.value = val
  updateLineCount()
  validateJson()
})

function updateLineCount() {
  lineCount.value = (localValue.value.match(/\n/g) || []).length + 1
}

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  localValue.value = target.value
  emit('update:modelValue', target.value)
  updateLineCount()
  validateJson()
}

function format() {
  try {
    const obj = JSON.parse(localValue.value)
    localValue.value = JSON.stringify(obj, null, 2)
    emit('update:modelValue', localValue.value)
    error.value = ''
    updateLineCount()
  } catch (e: any) { error.value = e.message }
}

function validateJson() {
  if (!localValue.value.trim()) { error.value = ''; return }
  try { JSON.parse(localValue.value); error.value = '' }
  catch (e: any) { error.value = e.message }
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

// VS Code 风格语法高亮 —— 用占位符避免嵌套
function highlight(text: string): string {
  if (!text) return ''
  // 一次性 tokenize，避免嵌套替换
  const result: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      // 字符串 token
      const start = i
      i++
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue }
        if (text[i] === '"') { i++; break }
        i++
      }
      const str = text.slice(start, i)
      // 判断是 key 还是 value（key 后面跟冒号）
      const after = text.slice(i).match(/^\s*:/)
      const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (after) {
        result.push('<span class="hl-key">' + escaped + '</span>')
      } else {
        result.push('<span class="hl-string">' + escaped + '</span>')
      }
    } else if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      result.push('<span class="hl-brace">' + ch + '</span>')
      i++
    } else if (ch === ':') {
      result.push('<span class="hl-punc">:</span>')
      i++
    } else if (ch === ',') {
      result.push('<span class="hl-punc">,</span>')
      i++
    } else if (/\d/.test(ch) || (ch === '-' && /\d/.test(text[i + 1] || ''))) {
      const start = i
      if (text[i] === '-') i++
      while (i < text.length && /\d/.test(text[i])) i++
      if (text[i] === '.') { i++; while (i < text.length && /\d/.test(text[i])) i++ }
      if (text[i] === 'e' || text[i] === 'E') { i++; if (text[i] === '+' || text[i] === '-') i++; while (i < text.length && /\d/.test(text[i])) i++ }
      result.push('<span class="hl-number">' + text.slice(start, i) + '</span>')
    } else if (text.slice(i).startsWith('true')) {
      result.push('<span class="hl-bool">true</span>'); i += 4
    } else if (text.slice(i).startsWith('false')) {
      result.push('<span class="hl-bool">false</span>'); i += 5
    } else if (text.slice(i).startsWith('null')) {
      result.push('<span class="hl-null">null</span>'); i += 4
    } else {
      // 空白字符原样输出
      const esc = text[i] === '&' ? '&amp;' : text[i] === '<' ? '&lt;' : text[i] === '>' ? '&gt;' : text[i]
      result.push(esc)
      i++
    }
  }
  return result.join('')
}

const highlightedHtml = computed(() => highlight(localValue.value))

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
        <span class="toolbar-hint">JSON</span>
        <span v-if="error" class="error-indicator" :title="error">⚠ 格式错误</span>
      </div>
      <t-button size="small" variant="text" @click="format" title="格式化 (Ctrl+Shift+F)">
        <template #icon><t-icon name="format" /></template>
        格式化
      </t-button>
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
  white-space: pre;
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
  background: transparent;
  color: transparent;
  caret-color: #fff;
  overflow: auto;
}
.editor-textarea::selection { background: rgba(38, 79, 120, 0.6); }

/* VS Code Dark 配色 */
.code-area :deep(.hl-key)    { color: #9cdcfe; }
.code-area :deep(.hl-string)  { color: #ce9178; }
.code-area :deep(.hl-number)  { color: #b5cea8; }
.code-area :deep(.hl-bool)    { color: #569cd6; }
.code-area :deep(.hl-null)    { color: #569cd6; }
.code-area :deep(.hl-brace)   { color: #da70d6; }
.code-area :deep(.hl-punc)    { color: #d4d4d4; }

/* 滚动条 */
.code-area ::-webkit-scrollbar { width: 10px; height: 10px; }
.code-area ::-webkit-scrollbar-track { background: transparent; }
.code-area ::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.4); border-radius: 4px; }
.code-area ::-webkit-scrollbar-thumb:hover { background: rgba(100,100,100,0.6); }
</style>
