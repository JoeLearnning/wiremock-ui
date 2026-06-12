<script setup lang="ts">
import { watch, ref, computed, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { StubMapping } from '@/api/types'
import { useGroupsStore } from '@/stores/groups'
import StubForm from './StubForm.vue'
import JsonEditor from './JsonEditor.vue'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import client from '@/api/client'

const groupsStore = useGroupsStore()

interface Props { visible?: boolean; stub: StubMapping | null; inline?: boolean }
const props = withDefaults(defineProps<Props>(), { visible: false, inline: false })
const emit = defineEmits<{ 'update:visible': [v: boolean]; save: [stub: StubMapping]; cancel: []; delete: []; testRequest: [config: any]; copyAsNew: [stub: StubMapping] }>()

const visible = computed({ get: () => props.visible, set: (v) => { if (!props.inline) emit('update:visible', v) } })
const isNew = computed(() => !(props.stub?.uuid || props.stub?.id))

const form = ref({
  name: '', description: '', method: 'GET', urlType: 'url' as string, url: '', prefix: '', stripPrefix: '',
  respMode: 'direct' as string, status: 200, contentType: 'application/json',
  responseBody: '{\n  "message": "success",\n  "code": 0,\n  "data": {}\n}',
  faultType: 'CONNECTION_RESET_BY_PEER', proxyBaseUrl: '',
  fixedDelay: 0, priority: 5,
  filters: [] as { type: string; key: string; operator: string; value: string; not: boolean }[],
  responseHeaders: [] as { key: string; value: string }[],
  selectedGroupId: '',
})

watch(() => props.stub, (s) => {
  if (s) {
    if (s.request || s.response) loadStub(s)
    else if (s.uuid || s.id) loadStub(s)
    else resetForm()
  } else {
    resetForm()
  }
}, { immediate: true })

function loadStub(s: StubMapping) {
  const f: any = form.value
  f.name = s.name || ''; f.description = (s.metadata?.description as string) || ''; f.method = s.request?.method || 'GET'; f.fixedDelay = s.response?.fixedDelayMilliseconds ?? 0; f.priority = s.priority ?? 5

  // Parse URL
  const savedPrefix = (s.metadata?.prefix as string) || ''
  f.prefix = savedPrefix
  let rawUrl = ''
  if (s.request?.url) { f.urlType = 'url'; rawUrl = s.request.url }
  else if (s.request?.urlPath) { f.urlType = 'urlPath'; rawUrl = s.request.urlPath }
  else if (s.request?.urlPathPattern) { f.urlType = 'urlPathPattern'; rawUrl = s.request.urlPathPattern }
  else if (s.request?.urlPattern) { f.urlType = 'urlPattern'; rawUrl = s.request.urlPattern }
  else { f.urlType = 'url'; rawUrl = '/' }
  // 去掉已存储的前缀，UI 中只显示相对路径
  if (savedPrefix && rawUrl.startsWith(savedPrefix)) {
    rawUrl = rawUrl.slice(savedPrefix.length) || '/'
  }
  f.url = rawUrl

  // Parse filters from WireMock patterns
  const filters: any[] = []
  const parsePatterns = (patterns: Record<string, any> | undefined, type: string) => {
    if (!patterns) return
    for (const [key, v] of Object.entries(patterns)) {
      if (typeof v === 'string') { filters.push({ type, key, operator: 'equalTo', value: v, not: false, caseInsensitive: false }) }
      else if (v && typeof v === 'object') {
        for (const op of ['equalTo','doesNotEqual','contains','doesNotContain','matches','doesNotMatch','absent']) {
          if (op in v) {
            filters.push({ type, key, operator: op, value: (op === 'absent' ? '' : String(v[op] || '')), not: false, caseInsensitive: !!v.caseInsensitive })
            break
          }
        }
      }
    }
  }
  parsePatterns(s.request?.headers, 'header')
  parsePatterns(s.request?.queryParameters, 'query')
  parsePatterns((s.request as any)?.cookies, 'cookie')
  // bodyPatterns
  if (s.request?.bodyPatterns) {
    for (const bp of s.request.bodyPatterns) {
      let matched = false
      // 检查 matchesJsonPath（可能为字符串或对象）
      if ((bp as any).matchesJsonPath !== undefined) {
        const mjp = (bp as any).matchesJsonPath
        if (typeof mjp === 'string') {
          filters.push({ type: 'body', key: '', operator: 'matchesJsonPath', value: mjp, not: false, caseInsensitive: false, subMatcher: '', subValue: '' })
        } else if (mjp && typeof mjp === 'object') {
          const expr = mjp.expression || ''
          // 查找子匹配器（排除 expression）
          const subKeys = ['equalTo','equalToJson','contains','doesNotContain','matches','absent']
          let sub = '' as string, subVal = '' as string
          for (const sk of subKeys) {
            if (mjp[sk] !== undefined) { sub = sk; subVal = sk === 'absent' ? '' : String(mjp[sk] || ''); break }
          }
          filters.push({ type: 'body', key: '', operator: 'matchesJsonPath', value: expr, not: false, caseInsensitive: false, subMatcher: sub, subValue: subVal })
        }
        matched = true
        continue
      }
      for (const op of ['equalTo','doesNotEqual','contains','doesNotContain','startsWith','endsWith','matches','doesNotMatch','equalToJson']) {
        if ((bp as any)[op] !== undefined) {
          const val = (bp as any)[op]
          filters.push({ type: 'body', key: '', operator: op, value: typeof val === 'string' ? val : JSON.stringify(val), not: false, caseInsensitive: !!(bp as any).caseInsensitive })
          matched = true
          break
        }
      }
      if (!matched && (bp as any).absent !== undefined) {
        filters.push({ type: 'body', key: '', operator: 'absent', value: '', not: false, caseInsensitive: false })
      }
    }
  }
  f.filters = filters

  f.selectedGroupId = (s.metadata?.groupId as string) || ''
  f.responseHeaders = s.response?.headers ? Object.entries(s.response.headers).filter(([k]) => k.toLowerCase() !== 'content-type').map(([k, v]) => ({ key: k, value: v })) : []
  if (s.response?.proxyBaseUrl) { f.respMode = 'proxy'; f.proxyBaseUrl = s.response.proxyBaseUrl; f.stripPrefix = (s.response as any).proxyUrlPrefixToRemove || '' }
  else if (s.response?.fault) { f.respMode = 'fault'; f.faultType = s.response.fault }
  else {
    f.respMode = 'direct'; f.status = s.response?.status ?? 200
    const ct = (s.response?.headers?.['Content-Type'] || s.response?.headers?.['content-type'] || '').split(';')[0]
    if (['text/html','text/xml','application/xml','text/plain'].includes(ct)) f.contentType = ct
    else f.contentType = 'application/json'
    f.responseBody = s.response?.jsonBody ? JSON.stringify(s.response.jsonBody, null, 2) : (s.response?.body || '')
  }
}

function resetForm() {
  form.value = {
    name: '', description: '', method: 'GET', urlType: 'url', url: '/', prefix: '', stripPrefix: '',
    respMode: 'direct', status: 200, contentType: 'application/json',
    responseBody: '{\n  "message": "success",\n  "code": 0,\n  "data": {}\n}',
    faultType: 'CONNECTION_RESET_BY_PEER', proxyBaseUrl: '',
    fixedDelay: 0, priority: 5, filters: [], responseHeaders: [], selectedGroupId: '',
  }
}

function buildStub(): StubMapping {
  // 拼上前缀（如果 URL 还没包含前缀的话）
  let fullUrl = form.value.url
  if (form.value.prefix) {
    const pfx = form.value.prefix.endsWith('/') ? form.value.prefix.slice(0, -1) : form.value.prefix
    if (!fullUrl.startsWith(pfx)) {
      fullUrl = pfx + (fullUrl.startsWith('/') ? fullUrl : '/' + fullUrl)
    }
  }
  const request: any = { method: form.value.method, [form.value.urlType]: fullUrl }

  // Convert filters to WireMock patterns
  const validFilters = form.value.filters.filter((f: any) => f.key.trim() || f.type === 'body')
  const bodyPatterns: any[] = []
  for (const f of validFilters) {
    const pattern: any = {}
    if (f.operator === 'absent') {
      pattern.absent = true
    } else if (f.operator === 'startsWith') {
      const escaped = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern.matches = '^' + escaped + '.*'
    } else if (f.operator === 'endsWith') {
      const escaped = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern.matches = '.*' + escaped + '$'
    } else if (f.operator === 'doesNotContain') {
      const escaped = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern.doesNotMatch = '.*' + escaped + '.*'
    } else if (f.operator === 'doesNotEqual') {
      const escaped = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern.doesNotMatch = '^' + escaped + '$'
    } else if (f.operator === 'matchesJsonPath') {
      // JSON Path 展开格式：支持 expression + 子匹配器
      const subMatcher = (f as any).subMatcher as string | undefined
      const subValue = (f as any).subValue as string | undefined
      if (subMatcher && subMatcher !== 'absent') {
        pattern.matchesJsonPath = { expression: f.value, [subMatcher]: subValue }
      } else if (subMatcher === 'absent') {
        pattern.matchesJsonPath = { expression: f.value, absent: true }
      } else {
        pattern.matchesJsonPath = f.value
      }
    } else {
      pattern[f.operator] = f.value
    }
    // 忽略大小写
    if ((f as any).caseInsensitive) {
      pattern.caseInsensitive = true
    }

    if (f.type === 'header') {
      if (!request.headers) request.headers = {}
      request.headers[f.key.trim()] = pattern
    } else if (f.type === 'query') {
      if (!request.queryParameters) request.queryParameters = {}
      request.queryParameters[f.key.trim()] = pattern
    } else if (f.type === 'cookie') {
      if (!request.cookies) request.cookies = {}
      request.cookies[f.key.trim()] = pattern
    } else if (f.type === 'body') {
      bodyPatterns.push(pattern)
    }
  }
  if (bodyPatterns.length) request.bodyPatterns = bodyPatterns

  const response: any = {}
  if (form.value.respMode === 'proxy') {
    response.proxyBaseUrl = form.value.proxyBaseUrl
    if (form.value.stripPrefix) response.proxyUrlPrefixToRemove = form.value.stripPrefix
  } else if (form.value.respMode === 'fault') response.fault = form.value.faultType
  else {
    response.status = form.value.status; response.headers = { 'Content-Type': form.value.contentType }
    try { response.jsonBody = JSON.parse(form.value.responseBody) } catch { response.body = form.value.responseBody }
  }
  if (form.value.responseHeaders.filter((h: any) => h.key.trim()).length) {
    if (!response.headers) response.headers = {}
    form.value.responseHeaders.filter((h: any) => h.key.trim()).forEach((h: any) => { response.headers[h.key.trim()] = h.value })
  }
  if (form.value.fixedDelay > 0) response.fixedDelayMilliseconds = form.value.fixedDelay
  const metadata: Record<string, unknown> = {}
  if (form.value.selectedGroupId) {
    const g = groupsStore.groups.find(g => g.id === form.value.selectedGroupId)
    if (g) { metadata.groupId = g.id; metadata.groupName = g.name }
  }
  if (form.value.description) metadata.description = form.value.description
  if (form.value.prefix) metadata.prefix = form.value.prefix
  if (form.value.stripPrefix) metadata.stripPrefix = form.value.stripPrefix
  return { ...(props.stub?.id ? { id: props.stub.id } : {}), ...(props.stub?.uuid ? { uuid: props.stub.uuid } : {}), name: form.value.name || undefined, priority: form.value.priority, request, response, metadata }
}

/**
 * 保存时先获取最新 metadata，保留 Playground 中保存的 testRequest，防止被覆盖
 */
async function handleSavePreservingTestRequest() {
  if (!form.value.url.trim()) return
  const stub = buildStub()
  // 从 WireMock 获取最新 metadata，确保 testRequest 不被覆盖
  const stubId = (props.stub?.uuid || props.stub?.id)
  if (stubId) {
    try {
      const { data: latest } = await client.get(`/mappings/${stubId}`)
      if (latest?.metadata?.testRequest) {
        stub.metadata = { ...(stub.metadata || {}), testRequest: latest.metadata.testRequest }
      }
    } catch { /* ignore */ }
  }
  emit('save', stub)
}

// JSON 预览
const previewVisible = ref(false)
const previewJson = ref('')
const previewParsed = ref<any>(null)
const jsonTheme = ref<'light' | 'dark'>('light')
const previewTab = ref<'edit' | 'preview'>('edit')

onMounted(() => {
  jsonTheme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
})

/** 预览打开的瞬间缓存下来的 testRequest，用于编辑 JSON 保存时不丢失 */
const cachedTestRequest = ref<any>(null)

async function openPreview() {
  const stub = buildStub()
  // 从 WireMock 拉取最新 testRequest，显示在预览 JSON 中
  const stubId = (props.stub?.uuid || props.stub?.id)
  cachedTestRequest.value = null
  if (stubId) {
    try {
      const { data: latest } = await client.get(`/mappings/${stubId}`)
      if (latest?.metadata?.testRequest) {
        cachedTestRequest.value = latest.metadata.testRequest
        stub.metadata = { ...(stub.metadata || {}), testRequest: latest.metadata.testRequest }
      }
    } catch { /* ignore */ }
  }
  previewJson.value = JSON.stringify(stub, null, 2)
  try { previewParsed.value = JSON.parse(previewJson.value) } catch { previewParsed.value = null }
  previewTab.value = 'preview'
  previewVisible.value = true
}

watch(previewJson, (val) => {
  try { previewParsed.value = JSON.parse(val) } catch { /* ignore */ }
})

function handlePreviewSave() {
  try {
    const parsed = JSON.parse(previewJson.value)
    // 将解析后的 JSON 回填至表单
    const f: any = form.value
    f.name = parsed.name || ''
    f.priority = parsed.priority ?? 5
    const req = parsed.request || {}
    f.method = req.method || 'GET'
    if (req.url) { f.urlType = 'url'; f.url = req.url }
    else if (req.urlPath) { f.urlType = 'urlPath'; f.url = req.urlPath }
    else if (req.urlPathPattern) { f.urlType = 'urlPathPattern'; f.url = req.urlPathPattern }
    else if (req.urlPattern) { f.urlType = 'urlPattern'; f.url = req.urlPattern }
    else { f.urlType = 'url'; f.url = '/' }
    // filters
    const filters: any[] = []
    const parsePats = (pats: any, type: string) => {
      if (!pats) return
      for (const [k, v] of Object.entries(pats)) {
        const pattern = v as any
        if (typeof pattern === 'string') filters.push({ type, key: k, operator: 'equalTo', value: pattern, not: false, caseInsensitive: false })
        else if (pattern && typeof pattern === 'object') {
          for (const op of ['equalTo','doesNotEqual','contains','doesNotContain','matches','doesNotMatch','absent']) {
            if (op in pattern) {
              filters.push({ type, key: k, operator: op, value: op === 'absent' ? '' : String(pattern[op] || ''), not: false, caseInsensitive: !!pattern.caseInsensitive })
              break
            }
          }
        }
      }
    }
    parsePats(req.headers, 'header')
    parsePats(req.queryParameters, 'query')
    parsePats(req.cookies, 'cookie')
    if (req.bodyPatterns) {
      for (const bp of req.bodyPatterns) {
        let matched = false
        // 检查 matchesJsonPath（可能为字符串或对象）
        if ((bp as any).matchesJsonPath !== undefined) {
          const mjp = (bp as any).matchesJsonPath
          if (typeof mjp === 'string') {
            filters.push({ type: 'body', key: '', operator: 'matchesJsonPath', value: mjp, not: false, caseInsensitive: false, subMatcher: '', subValue: '' })
          } else if (mjp && typeof mjp === 'object') {
            const expr = mjp.expression || ''
            const subKeys = ['equalTo','equalToJson','contains','doesNotContain','matches','absent']
            let sub = '' as string, subVal = '' as string
            for (const sk of subKeys) {
              if (mjp[sk] !== undefined) { sub = sk; subVal = sk === 'absent' ? '' : String(mjp[sk] || ''); break }
            }
            filters.push({ type: 'body', key: '', operator: 'matchesJsonPath', value: expr, not: false, caseInsensitive: false, subMatcher: sub, subValue: subVal })
          }
          matched = true
          continue
        }
        for (const op of ['equalTo','doesNotEqual','contains','doesNotContain','startsWith','endsWith','matches','doesNotMatch','equalToJson']) {
          if (bp[op] !== undefined) {
            const val = bp[op]
            const key = op === 'matchesJsonPath' ? 'jsonPath' : ''
            filters.push({ type: 'body', key, operator: op, value: typeof val === 'string' ? val : JSON.stringify(val), not: false, caseInsensitive: !!(bp as any).caseInsensitive })
            matched = true
            break
          }
        }
        if (!matched && (bp as any).absent !== undefined) {
          filters.push({ type: 'body', key: '', operator: 'absent', value: '', not: false, caseInsensitive: false })
        }
      }
    }
    f.filters = filters
    const resp = parsed.response || {}
    if (resp.proxyBaseUrl) { f.respMode = 'proxy'; f.proxyBaseUrl = resp.proxyBaseUrl; f.stripPrefix = resp.proxyUrlPrefixToRemove || '' }
    else if (resp.fault) { f.respMode = 'fault'; f.faultType = resp.fault }
    else {
      f.respMode = 'direct'; f.status = resp.status ?? 200
      f.contentType = (resp.headers?.['Content-Type'] || resp.headers?.['content-type'] || 'application/json').split(';')[0]
      f.responseBody = resp.jsonBody ? JSON.stringify(resp.jsonBody, null, 2) : (resp.body || '')
    }
    f.responseHeaders = resp.headers ? Object.entries(resp.headers).filter(([k]) => k.toLowerCase() !== 'content-type').map(([k, v]) => ({ key: k, value: v as string })) : []
    f.fixedDelay = resp.fixedDelayMilliseconds ?? 0
    f.description = (parsed.metadata?.description as string) || ''
    f.selectedGroupId = (parsed.metadata?.groupId as string) || ''
    f.prefix = (parsed.metadata?.prefix as string) || ''
    f.stripPrefix = (parsed.metadata?.stripPrefix as string) || ''

    previewVisible.value = false
    // 立即保存，保留 testRequest
    const stub = buildStub()
    if (cachedTestRequest.value) {
      stub.metadata = { ...(stub.metadata || {}), testRequest: cachedTestRequest.value }
    }
    emit('save', stub)
  } catch (e: any) {
    MessagePlugin.error('JSON 解析失败: ' + (e.message || '格式错误'))
  }
}

function handleCopy() {
  const copy = buildStub()
  delete (copy as any).id
  delete (copy as any).uuid
  copy.name = (copy.name || 'mock') + ' - 副本'
  emit('copyAsNew', copy)
}

async function handleTestRequest() {
  const stubId = (props.stub?.uuid || props.stub?.id)
  if (!stubId) return
  try {
    // 从 API 获取最新数据（包含 metadata）
    const { data: latest } = await client.get(`/mappings/${stubId}`)
    const saved = latest?.metadata?.testRequest as any
    if (saved) {
      emit('testRequest', { ...saved, stubId, stubName: form.value.name || '' })
      return
    }
  } catch { /* ignore */ }
  // 从当前请求定义构建（兜底）
  const hdrs: { key: string; value: string }[] = []
  form.value.filters.filter((f: any) => f.type === 'header' && f.key.trim()).forEach((f: any) => {
    hdrs.push({ key: f.key, value: f.value })
  })
  // 发送测试请求时带上完整路径（前缀 + URL）
  let url = form.value.url
  if (form.value.prefix) {
    const pfx = form.value.prefix.endsWith('/') ? form.value.prefix.slice(0, -1) : form.value.prefix
    const path = url.startsWith('/') ? url : '/' + url
    url = pfx + path
  }
  const queryParams = form.value.filters.filter((f: any) => f.type === 'query' && f.key.trim())
  if (queryParams.length) {
    const qs = queryParams.map((f: any) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  emit('testRequest', {
    method: form.value.method, url,
    headers: hdrs,
    body: form.value.method !== 'GET' && form.value.method !== 'HEAD' ? form.value.responseBody : '',
    stubId, stubName: form.value.name || '',
  })
}
</script>

<template>
  <t-drawer v-if="!inline" v-model:visible="visible" :header="isNew ? '新建 Mock 规则' : '编辑 Mock 规则'" size="700px" :footer="true" :confirm-btn="{ content: '保存', theme: 'primary' }" :cancel-btn="isNew ? '取消' : '删除'" @confirm="handleSavePreservingTestRequest" @cancel="isNew ? emit('cancel') : emit('delete')">
    <t-form label-width="96px" class="stub-form"><StubForm v-model:form="form" /></t-form>
  </t-drawer>

  <div v-else class="inline-editor">
    <div class="inline-header"><span class="inline-title">{{ isNew ? '新建 Mock 规则' : '编辑 Mock 规则' }}</span><t-button size="small" variant="text" @click="emit('cancel')"><t-icon name="close" /></t-button></div>
    <t-form label-width="96px" class="stub-form"><StubForm v-model:form="form" /></t-form>
    <div class="inline-footer">
      <t-button theme="primary" @click="handleSavePreservingTestRequest">保存</t-button>
      <t-button @click="emit('cancel')">取消</t-button>
      <t-button theme="default" @click="handleTestRequest">
        <template #icon><t-icon name="play-circle" /></template>测试
      </t-button>
      <t-button theme="default" @click="openPreview">
        <template #icon><t-icon name="code" /></template>预览 JSON
      </t-button>
      <t-button v-if="!isNew" theme="warning" @click="handleCopy">
        <template #icon><t-icon name="file-copy" /></template>复制
      </t-button>
      <div class="spacer" />
      <t-popconfirm v-if="!isNew" content="确定删除该 Mock 规则？" @confirm="emit('delete')">
        <t-button theme="danger">删除</t-button>
      </t-popconfirm>
    </div>
  </div>

  <!-- JSON 预览对话框 -->
  <t-dialog
    v-model:visible="previewVisible"
    header="Mock JSON 预览"
    width="1200px"
    :top="'5vh'"
    :confirm-btn="{ content: '保存', theme: 'primary' }"
    :cancel-btn="{ content: '取消' }"
    @confirm="handlePreviewSave"
    class="preview-dialog"
  >
    <t-tabs v-model="previewTab" size="small" class="preview-tabs">
      <t-tab-panel value="preview" label="美化预览">
        <div v-if="previewParsed" class="preview-box">
          <VueJsonPretty :data="previewParsed" :theme="jsonTheme" :deep="10" showLength />
        </div>
        <div v-else class="preview-error">JSON 格式错误，无法预览</div>
      </t-tab-panel>
      <t-tab-panel value="edit" label="编辑">
        <div class="edit-pane">
          <JsonEditor v-model="previewJson" />
        </div>
      </t-tab-panel>
    </t-tabs>
  </t-dialog>
</template>

<style scoped>
.inline-editor { height: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.inline-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--td-component-stroke); flex-shrink: 0; }
.inline-title { font-size: 14px; font-weight: 600; }

.inline-editor .stub-form { flex: 1; overflow: hidden auto; padding: 12px 16px 60px; }

.inline-footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px; border-top: 1px solid var(--td-component-stroke); display: flex; gap: 8px; align-items: center; background: var(--td-bg-color-container); z-index: 1; }
.inline-footer .spacer { flex: 1; }

/* JsonEditor —— 所有实例撑大 */
.stub-form :deep(.json-editor) .editor-body { min-height: 300px; max-height: none !important; }
.stub-form :deep(.json-editor) .editor-textarea { min-height: 280px; }

.preview-tabs { display: flex; flex-direction: column; height: 100%; }
.preview-tabs :deep(.t-tabs__content) { flex: 1; overflow: hidden; min-height: 0; }
.edit-pane { height: 100%; display: flex; flex-direction: column; }
.edit-pane :deep(.json-editor) { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.edit-pane :deep(.json-editor .editor-body) { flex: 1; min-height: 0; max-height: none; }

.preview-tabs :deep(.t-tab-panel) { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.preview-tabs :deep(.t-tab-panel > *) { flex: 1; min-height: 0; }
.preview-box {
  background: var(--td-bg-color-page);
  border-radius: 6px;
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}
.preview-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--td-error-color);
  font-size: 14px;
}
</style>

<style>
.preview-dialog .t-dialog { height: 80vh; display: flex; flex-direction: column; }
.preview-dialog .t-dialog__body { flex: 1; overflow-y: auto; padding: 16px 24px; min-height: 0; }
.preview-dialog .t-dialog__footer { flex-shrink: 0; }
</style>
