<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLTextAreaElement | null>(null)
const localValue = ref(props.modelValue)
const error = ref('')
const lineCount = ref(1)

watch(
  () => props.modelValue,
  (val) => {
    localValue.value = val
    updateLineCount()
    validateJson()
  }
)

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
  } catch (e: any) {
    error.value = e.message
  }
}

function validateJson() {
  if (!localValue.value.trim()) {
    error.value = ''
    return
  }
  try {
    JSON.parse(localValue.value)
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
    const start = ta.selectionStart
    const end = ta.selectionEnd
    localValue.value = localValue.value.substring(0, start) + '  ' + localValue.value.substring(end)
    emit('update:modelValue', localValue.value)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
    })
  }
  // Ctrl/Cmd + Shift + F to format
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
    e.preventDefault()
    format()
  }
}

// Generate line numbers
const lineNumbers = ref<string[]>([])
function computeLineNumbers() {
  const count = lineCount.value
  lineNumbers.value = Array.from({ length: count }, (_, i) => String(i + 1))
}
watch(lineCount, computeLineNumbers)
onMounted(computeLineNumbers)
</script>

<template>
  <div class="json-editor">
    <div class="editor-toolbar">
      <span class="toolbar-hint">JSON</span>
      <div class="flex-center gap-8">
        <span v-if="error" class="error-indicator" :title="error">⚠ JSON 格式错误</span>
        <t-button size="small" variant="text" @click="format" title="格式化 (Ctrl+Shift+F)">
          <template #icon><t-icon name="format" /></template>
        </t-button>
      </div>
    </div>
    <div class="editor-body">
      <div class="line-numbers">
        <div v-for="ln in lineNumbers" :key="ln" class="line-num">{{ ln }}</div>
      </div>
      <textarea
        ref="editorRef"
        class="editor-textarea"
        :value="localValue"
        spellcheck="false"
        @input="onInput"
        @keydown="handleKeydown"
      />
    </div>
    <div v-if="error" class="editor-error">{{ error }}</div>
  </div>
</template>

<style scoped>
.json-editor {
  width: 100%;
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  overflow: hidden;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-component-stroke);
}
.toolbar-hint {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
.error-indicator {
  font-size: 12px;
  color: var(--td-error-color);
  cursor: help;
}
.editor-body {
  display: flex;
  min-height: 200px;
  max-height: 400px;
  overflow: auto;
}
.line-numbers {
  padding: 8px 0;
  background: var(--td-bg-color-container);
  border-right: 1px solid var(--td-component-stroke);
  user-select: none;
  text-align: right;
  min-width: 40px;
  flex-shrink: 0;
}
.line-num {
  padding: 0 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--td-text-color-placeholder);
  font-family: 'Consolas', 'Monaco', monospace;
}
.editor-textarea {
  flex: 1;
  border: none;
  outline: none;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  resize: none;
  tab-size: 2;
  background: var(--td-bg-color-container);
  color: var(--td-text-color-primary);
}
.editor-textarea:focus {
  background: var(--td-bg-color-container-select);
}
.editor-error {
  padding: 6px 12px;
  background: var(--td-error-color-1);
  color: var(--td-error-color);
  font-size: 12px;
  border-top: 1px solid var(--td-error-color-3);
}
</style>
